import { createLogger } from '@/utils/logger.js'

const logger = createLogger('AiSse')

/**
 * 解析 AI 后端的 SSE 流（text/event-stream），并通过回调分发各类事件。
 *
 * 后端事件类型：
 *   - `tool_delta` — 模型正在生成的工具调用增量（JSON 对象）
 *   - `status`   — 当前任务状态（纯字符串）
 *   - `delta`    — 回复正文增量片段（纯字符串）
 *   - `warn`     — 轮次警告文本（纯字符串）
 *   - `error_meta` — 错误分类与建议动作（JSON 对象）
 *   - `error`      — 错误信息（纯字符串）
 *   - `node`      — 在任务树中创建新节点（JSON，kind 字段区分类型）
 *   - `patch`     — 更新任务树中的已有节点（JSON，kind 字段区分类型）
 *   - `turn`      — 轮次结束合并事件：content + usage? + review（取代 reply+usage+review）
 *   - `turn/started`   — 控制协议 Turn 已开始
 *   - `turn/completed` — 控制协议 Turn 进入 completed / interrupted / failed 终态
 *   - `trace`     — 本轮统一关联信息：traceId + turnId? + runId?
 *   - `subagent_event` — Puppet AI 子任务的嵌套流式事件
 *
 * @param {Response} response  - fetch() 返回的 Response 对象（Content-Type: text/event-stream）
 * @param {object}   handlers
 * @param {Function} [handlers.onToolDelta] - (entry: object) => void
 * @param {Function} [handlers.onStatus]   - (message: string) => void
 * @param {Function} [handlers.onDelta]    - (delta: string) => void
 * @param {Function} [handlers.onWarn]     - (message: string) => void
 * @param {Function} [handlers.onHeartbeat] - (payload: object) => void
 * @param {Function} [handlers.onEventSeq] - (seq: number) => void
 * @param {Function} [handlers.onErrorMeta] - (meta: object) => void
 * @param {Function} [handlers.onError]     - (message: string, meta?: object) => void
 * @param {Function} [handlers.onNode]          - (data: object, seq: number) => void
 * @param {Function} [handlers.onPatch]         - (data: object, seq: number) => void
 * @param {Function} [handlers.onTurn]          - (data: object, seq: number) => void  终态事件（含 content/usage/review）
 * @param {Function} [handlers.onTurnStarted]   - (data: object, seq: number) => void
 * @param {Function} [handlers.onTurnCompleted] - (data: object, seq: number) => void
 * @param {Function} [handlers.onTrace]         - (data: object, seq: number) => void
 * @returns {Promise<string>} 最终的 AI 回复文本（turn.content），若无则返回空字符串
 */
export async function parseAiSseStream(response, {
  onToolDelta,
  onStatus,
  onDelta,
  onWarn,
  onHeartbeat,
  onEventSeq,
  onErrorMeta,
  onError,
  onNode,
  onPatch,
  onSubagentEvent,
  onTurn,
  onTurnStarted,
  onTurnCompleted,
  onTrace
} = {}) {
  if (!response.body) {
    throw new Error('响应体为空，无法读取 SSE 流')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  let buffer = ''
  let currentEvent = ''
  let currentData = ''
  let currentId = ''
  let replyText = ''
  let errorMeta = null
  let receivedTurnStarted = false
  let receivedTurnCompleted = false

  const jsonHandlers = new Map([
    ['tool_delta', onToolDelta],
    ['heartbeat', onHeartbeat],
    ['error_meta', onErrorMeta],
    ['node', onNode],
    ['patch', onPatch],
    ['subagent_event', onSubagentEvent],
    ['turn', onTurn],
    ['turn/started', onTurnStarted],
    ['turn/completed', onTurnCompleted],
    ['trace', onTrace]
  ])

  const parseDataLine = (line) => {
    let value = line.slice(5)
    if (value.startsWith(' ')) value = value.slice(1)
    return value
  }

  const parseEventId = (eventId) => {
    const [seqText = '0', turnId = '', itemId = '', runId = '', subagentInvocationId = ''] =
      String(eventId || '').split('|')
    const seq = Number(seqText || 0)
    return {
      seq: Number.isFinite(seq) ? seq : 0,
      turnId: turnId || null,
      itemId: itemId || null,
      runId: runId || null,
      subagentInvocationId: subagentInvocationId || null
    }
  }

  const dispatchEvent = (eventName, dataStr, eventId) => {
    const payload = eventName === 'delta' ? dataStr : dataStr.trimEnd()
    if (!eventName) return
    const eventMeta = parseEventId(eventId)
    const seq = eventMeta.seq
    let shouldAdvanceCursor = eventName !== 'turn/completed'

    try {
      if (eventName === 'delta') {
        onDelta?.(payload, seq, eventMeta)
        return
      }

      if (!payload) return

      if (eventName === 'status') {
        onStatus?.(payload, seq, eventMeta)
      } else if (eventName === 'warn') {
        onWarn?.(payload, seq, eventMeta)
      } else if (eventName === 'error') {
        onError?.(payload, errorMeta, seq, eventMeta)
      } else if (jsonHandlers.has(eventName)) {
        try {
          const entry = JSON.parse(payload)
          if (eventName === 'error_meta') errorMeta = entry
          if (eventName === 'turn') replyText = String(entry?.content ?? '')
          jsonHandlers.get(eventName)?.(entry, seq, eventMeta)
          // turn 仅聚合模型结果，控制协议终态由 turn/completed 决定。
          if (eventName === 'turn/started') receivedTurnStarted = true
          if (eventName === 'turn/completed') receivedTurnCompleted = true
          shouldAdvanceCursor = true
        } catch {
          shouldAdvanceCursor = eventName !== 'turn/started' && eventName !== 'turn/completed'
        }
      }
    } finally {
      if (shouldAdvanceCursor && seq > 0) {
        onEventSeq?.(seq, eventMeta)
      }
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      // 最后一段可能不完整，留在 buffer 中
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim()
        } else if (line.startsWith('id:')) {
          currentId = line.slice(3).trim()
        } else if (line.startsWith('data:')) {
          currentData += (currentData ? '\n' : '') + parseDataLine(line)
        } else if (line === '') {
          // 空行表示一个事件结束
          dispatchEvent(currentEvent, currentData, currentId)
          currentEvent = ''
          currentData = ''
          currentId = ''
        }
      }
    }

    // 处理末尾残留（无结尾空行时）
    if (currentEvent || currentData) {
      dispatchEvent(currentEvent, currentData, currentId)
    }
    if (receivedTurnCompleted) return replyText
    if (receivedTurnStarted) {
      const error = new Error('SSE 流在 Turn 终态到达前结束')
      error.code = 'AI_TURN_INCOMPLETE'
      throw error
    }
  } finally {
    reader.releaseLock()
  }

  return replyText
}

/**
 * 构建 SSE fetch 请求并解析流。
 *
 * @param {string} url       - 请求 URL
 * @param {object} body      - 请求体（JSON）
 * @param {AbortSignal} [signal] - 用于取消请求
 * @param {object} [handlers]    - 事件回调（同 parseAiSseStream）
 * @returns {Promise<string>} 最终回复文本
 */
export async function fetchAiSse(url, body, signal, handlers = {}) {
  const startedAt = Date.now()
  const tag = `[fetchAiSse ${url}]`
  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
      signal
    })
  } catch (fetchErr) {
    logger.error(`${tag} fetch 阶段抛出异常 name=${fetchErr?.name} message=${fetchErr?.message} 耗时=${Date.now() - startedAt}ms`, fetchErr)
    throw fetchErr
  }

  logger.info(`${tag} 响应 status=${res.status} ok=${res.ok} contentType=${res.headers.get('content-type')} 耗时=${Date.now() - startedAt}ms`)

  if (!res.ok) {
    let detail = res.statusText || '请求失败'
    try {
      const t = await res.text()
      if (t?.trim()) detail = t.length > 600 ? `${t.slice(0, 600)}…` : t
    } catch {
      // ignore
    }
    logger.error(`${tag} 非 2xx 响应 status=${res.status} detail=${detail}`)
    throw new Error(detail)
  }

  try {
    const reply = await parseAiSseStream(res, handlers)
    logger.info(`${tag} SSE 流正常结束 replyLen=${(reply || '').length} 总耗时=${Date.now() - startedAt}ms`)
    return reply
  } catch (streamErr) {
    logger.error(`${tag} SSE 流读取阶段抛出异常 name=${streamErr?.name} message=${streamErr?.message} 总耗时=${Date.now() - startedAt}ms`, streamErr)
    throw streamErr
  }
}
