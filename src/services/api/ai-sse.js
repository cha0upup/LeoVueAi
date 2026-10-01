import { createLogger } from '@/utils/logger.js'
import { createHttpError } from '../httpError.js'
import { handleHttpError } from '../httpErrorHandling.js'
import { createSessionChangedError, isCurrentSession, registerSessionCleanup, sessionGeneration } from '../sessionLifecycle.js'
import { createSseFrameDecoder } from './sseFrameDecoder.js'

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
 *   - `subagent_event` — Node AI 子任务的嵌套流式事件
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

  let replyText = ''
  let errorMeta = null
  let receivedTurnStarted = false
  let receivedTurnCompleted = false
  let streamEnded = false

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
    let shouldAdvanceCursor = eventName !== 'turn/started' && eventName !== 'turn/completed'

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
        let entry
        try {
          entry = JSON.parse(payload)
        } catch {
          shouldAdvanceCursor = eventName !== 'turn/started' && eventName !== 'turn/completed'
          logger.warn('忽略格式错误的 AI 事件', eventName, seq)
          return
        }
        if (eventName === 'error_meta') errorMeta = entry
        if (eventName === 'turn') replyText = String(entry?.content ?? '')
        // A new started event invalidates the preceding turn's terminal marker.
        if (eventName === 'turn/started') {
          receivedTurnStarted = true
          receivedTurnCompleted = false
        }
        try {
          jsonHandlers.get(eventName)?.(entry, seq, eventMeta)
        } catch (error) {
          shouldAdvanceCursor = false
          if (eventName !== 'turn/started' && eventName !== 'turn/completed') throw error
          logger.warn('AI 控制事件应用失败', eventName, seq, error)
          return
        }
        if (eventName === 'turn/completed') receivedTurnCompleted = true
        shouldAdvanceCursor = true
      }
    } catch (error) {
      shouldAdvanceCursor = false
      throw error
    } finally {
      if (shouldAdvanceCursor && seq > 0) {
        onEventSeq?.(seq, eventMeta)
      }
    }
  }

  const frames = createSseFrameDecoder(dispatchEvent)
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        streamEnded = true
        break
      }

      frames.push(decoder.decode(value, { stream: true }))
    }

    frames.push(decoder.decode())
    frames.finish()
    if (receivedTurnCompleted) return replyText
    if (receivedTurnStarted) {
      const error = new Error('SSE 流在 Turn 终态到达前结束')
      error.code = 'AI_TURN_INCOMPLETE'
      throw error
    }
  } finally {
    if (!streamEnded) {
      try { await reader.cancel() } catch { /* The transport may already have aborted. */ }
    }
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
  const requestGeneration = sessionGeneration.value
  const controller = new AbortController()
  const forwardAbort = () => controller.abort(signal?.reason)
  if (signal?.aborted) forwardAbort()
  else signal?.addEventListener('abort', forwardAbort, { once: true })
  const unregister = registerSessionCleanup(Symbol('ai-stream'), () => controller.abort())
  try {
    return await readAiSse(url, body, controller.signal, handlers, requestGeneration, startedAt, tag)
  } catch (error) {
    if (!isCurrentSession(requestGeneration)) throw createSessionChangedError()
    throw error?.response ? handleHttpError(error, requestGeneration) : error
  } finally {
    unregister()
    signal?.removeEventListener('abort', forwardAbort)
  }
}

async function readAiSse(url, body, signal, handlers, requestGeneration, startedAt, tag) {
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

  if (!isCurrentSession(requestGeneration)) throw createSessionChangedError()
  if (!res.ok || res.headers.get('content-type')?.includes('application/json')) {
    let detail = res.statusText || '请求失败'
    let payload = null
    try {
      const t = await res.text()
      if (t?.trim()) detail = t.length > 600 ? `${t.slice(0, 600)}…` : t
      try { payload = JSON.parse(t) } catch { /* Retain the text fallback for non-JSON errors. */ }
    } catch {
      // ignore
    }
    if (res.ok && Number(payload?.code) === 200) {
      throw new Error('预期 SSE 事件流，收到普通 JSON 响应')
    }
    const error = createHttpError({ status: res.status, statusText: res.statusText, data: payload }, detail)
    logger.error(`${tag} 事件流请求失败 status=${res.status} code=${error.code}`)
    throw error
  }

  try {
    const guardedHandlers = Object.fromEntries(Object.entries(handlers).map(([name, callback]) => [
      name,
      typeof callback === 'function'
        ? (...args) => {
            if (!isCurrentSession(requestGeneration)) throw createSessionChangedError()
            return callback(...args)
          }
        : callback
    ]))
    const reply = await parseAiSseStream(res, guardedHandlers)
    if (!isCurrentSession(requestGeneration)) throw createSessionChangedError()
    logger.info(`${tag} SSE 流正常结束 replyLen=${(reply || '').length} 总耗时=${Date.now() - startedAt}ms`)
    return reply
  } catch (streamErr) {
    logger.error(`${tag} SSE 流读取阶段抛出异常 name=${streamErr?.name} message=${streamErr?.message} 总耗时=${Date.now() - startedAt}ms`, streamErr)
    throw streamErr
  }
}
