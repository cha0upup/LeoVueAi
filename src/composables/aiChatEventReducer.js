/**
 * AI 对话 SSE 事件 reducer。
 *
 * 设计：
 * - 每种事件类型对应 EVENT_HANDLERS 表中的一个独立 handler；applyAiEvent 只做 dispatch
 * - 所有 status 变更走 transitionStatus（状态机模块），不允许任何 handler 直接写 state.status
 * - 渲染数据源：msg.nodes（Task Tree）；msg.content 保存最终回复文本
 * - 消息形状由 aiMessageFactory 工厂函数统一定义
 */

import { ACTIVE_AI_STATUSES, TERMINAL_AI_STATUSES, normalizeAiStatus } from '@/utils/aiRuntime.js'
import { transitionStatus } from './aiChatStateMachine.js'
import { createAssistantMessage } from './aiMessageFactory.js'
import {
  createNarrationNode,
  createTextNode,
  createThinkingNode,
  createToolNode,
  createSubtaskNode,
  createUserInputNode,
  findSubtask,
  normalizePlan,
  normalizePlanStepStatus,
  getLiveText,
  sealLiveTextOrNarration,
  findTool,
  TOOL_STATUS
} from './aiTurnModel.js'

// ────────────────────────────────────────────────────────────────────
// 辅助：runtime / 子结构归一化
// ────────────────────────────────────────────────────────────────────

function patchRuntime(msg, patch) {
  if (!msg) return
  msg.runtime = { ...(msg.runtime || {}), ...patch, updatedAt: Date.now() }
}

// ────────────────────────────────────────────────────────────────────
// Task Tree adapter helpers
// 每个 SSE 事件处理完旧结构后，同步写入 msg.nodes（新架构）。
// ────────────────────────────────────────────────────────────────────

function ensureNodes(msg) {
  if (!Array.isArray(msg.nodes)) msg.nodes = []
  return msg.nodes
}

/** delta → live text node（append 或新建） */
function nodeAdaptDelta(msg, text) {
  if (!msg || !text) return
  const nodes = ensureNodes(msg)
  const live = getLiveText(nodes)
  live.content = `${live.content}${text}`
}

/** thinking 事件 → thinking node */
function nodeAdaptThinking(msg, data, seq) {
  if (!msg) return
  const nodes = ensureNodes(msg)
  sealLiveTextOrNarration(nodes)
  const content = data?.content ?? (typeof data === 'string' ? data : '')
  nodes.push(createThinkingNode({ content, seq }))
}

/** progress 事件 → sealed narration node */
function nodeAdaptProgress(msg, data, seq) {
  if (!msg) return
  const nodes = ensureNodes(msg)
  sealLiveTextOrNarration(nodes)
  const content = data?.content ?? String(data ?? '')
  if (content.trim()) {
    nodes.push(createNarrationNode({ content, streaming: false, seq }))
  }
}

/**
 * node{kind:"text"} 事件 → 闭合一段流式可见文本。
 *
 * 服务端在 thinking / tool / complete 边界把累积的可见 token 封装为权威 text 段。
 * 与 delta 关系：delta 仅用于直播预览，真值以 text 段为准。
 *
 * 处理：若末尾存在 live text（由 delta 累积而来），用权威 content 覆盖并 seal；
 * 否则直接 push 一个 sealed text 节点。下一段 delta 会自动启新的 live text，
 * 与思考块/工具节点之间的相对顺序由 SSE seq 决定。
 */
function nodeAdaptTextSegment(msg, data, seq) {
  if (!msg) return
  const nodes = ensureNodes(msg)
  const content = String(data?.content ?? '').trim()
  if (!content) {
    sealLiveTextOrNarration(nodes)
    return
  }
  const last = nodes[nodes.length - 1]
  if (last?.kind === 'text' && last.streaming) {
    last.content = content
    last.streaming = false
    return
  }
  nodes.push(createTextNode({ content, streaming: false, seq }))
}

/** tool_start / tool_delta / tool 事件 → find-or-create tool node */
function nodeAdaptTool(msg, name, data, seq) {
  if (!msg) return
  const nodes = ensureNodes(msg)
  sealLiveTextOrNarration(nodes)
  const toolCallId = data?.toolCallId ? String(data.toolCallId) : null
  let node = findTool(nodes, { toolCallId, name, seq })
  if (!node) {
    node = createToolNode({
      name: data?.toolName ?? name,
      toolCallId,
      args: data?.arguments ?? null,
      toolKind: data?.toolKind ?? null,
      businessTool: data?.businessTool !== false,
      terminal: data?.terminal === true,
      exclusive: data?.exclusive === true,
      status: TOOL_STATUS.PENDING,
      seq
    })
    nodes.push(node)
  }
  // patch fields from event
  if (data?.arguments != null && (node.args == null || data?.success != null)) node.args = data.arguments
  if (data?.toolKind != null) node.toolKind = data.toolKind
  if (data?.businessTool != null) node.businessTool = data.businessTool !== false
  if (data?.terminal != null) node.terminal = data.terminal === true
  if (data?.exclusive != null) node.exclusive = data.exclusive === true
  if (data?.status === 'running') node.status = TOOL_STATUS.RUNNING
  if (data?.success != null) {
    node.success = data.success
    node.status  = data.success === false ? TOOL_STATUS.FAILED : TOOL_STATUS.DONE
  }
  if (data?.resultPreview != null) node.result = data.resultPreview
  if (data?.result != null) node.result = data.result
  if (data?.error != null) node.error = String(data.error)
  if (data?.endTime) node.endTime = Number(data.endTime)
  node.updatedAt = Date.now()
}

/** 平台 AI → Puppet AI 派发节点的生命周期更新。 */
function nodeAdaptSubtask(msg, data, seq) {
  if (!msg || !data?.subagentInvocationId) return null
  const nodes = ensureNodes(msg)
  sealLiveTextOrNarration(nodes)
  let node = findSubtask(nodes, data.subagentInvocationId)
  if (!node) {
    node = createSubtaskNode({
      invocationId: data.subagentInvocationId,
      childThreadId: data.childThreadId,
      sessionId: data.sessionId,
      puppetId: data.puppetId,
      task: data.task,
      status: data.status,
      summary: data.summary,
      seq,
      createdAt: data.createdAt
    })
    nodes.push(node)
  } else {
    if (data.childThreadId) node.childThreadId = data.childThreadId
    if (data.sessionId) node.sessionId = data.sessionId
    if (data.puppetId) node.puppetId = data.puppetId
    if (data.task) node.task = data.task
    if (data.status) node.status = data.status
    if (data.summary != null) node.summary = data.summary
    if (data.completedAt != null) node.completedAt = data.completedAt
    node.updatedAt = Date.now()
  }
  return node
}

/** 将子 Agent 的原始流式事件归入对应 subtask.children，不污染父 Agent 正文。 */
function nodeAdaptSubtaskEvent(msg, data, seq) {
  if (!msg || !data?.subagentInvocationId) return
  const node = nodeAdaptSubtask(msg, {
    subagentInvocationId: data.subagentInvocationId,
    childThreadId: data.childThreadId,
    status: 'running'
  }, seq)
  if (!node) return
  const children = node.children
  const childMsg = { nodes: children }
  const eventName = data.eventName
  const eventData = data.eventData
  const childSeq = Number(data.childSeq ?? seq ?? 0)

  if (eventName === 'delta') {
    const live = getLiveText(children)
    live.content = `${live.content}${String(eventData ?? '')}`
  } else if (eventName === 'thinking') {
    nodeAdaptThinking(childMsg, eventData, childSeq)
  } else if (eventName === 'tool_delta') {
    nodeAdaptTool(childMsg, eventData?.toolName ?? 'tool', eventData, childSeq)
  } else if (eventName === 'node') {
    const kind = eventData?.kind
    if (kind === 'thinking') nodeAdaptThinking(childMsg, eventData, childSeq)
    else if (kind === 'text') nodeAdaptTextSegment(childMsg, eventData, childSeq)
    else if (kind === 'tool') nodeAdaptTool(childMsg, eventData?.toolName ?? 'tool', eventData, childSeq)
    else if (kind === 'plan') node.plan = normalizePlan(eventData, childSeq)
    else if (kind === 'user_input') nodeAdaptUserInput({ pendingUserInput: null, sending: false, status: 'running' }, childMsg, eventData, childSeq)
  } else if (eventName === 'patch') {
    const kind = eventData?.kind
    if (kind === 'tool') nodeAdaptTool(childMsg, eventData?.toolName ?? 'tool', eventData, childSeq)
    else if (kind === 'plan') node.plan = normalizePlan(eventData, childSeq)
    else if (kind === 'user_input') nodeAdaptUserInput({ pendingUserInput: null, sending: false, status: 'running' }, childMsg, eventData, childSeq)
  } else if (eventName === 'plan') {
    node.plan = normalizePlan(eventData, childSeq)
  } else if (eventName === 'warn') {
    sealLiveTextOrNarration(children)
    children.push(createNarrationNode({ content: `⚠ ${String(eventData ?? '')}`, streaming: false, seq: childSeq }))
  } else if (eventName === 'status' && typeof eventData === 'string') {
    node.status = eventData
  }
  node.updatedAt = Date.now()
}

function nodeAdaptUserInput(state, msg, data, seq) {
  if (!msg || !data?.questionId) return
  const nodes = ensureNodes(msg)
  sealLiveTextOrNarration(nodes)
  const existing = nodes.find(node =>
    node.kind === 'user_input' && String(node.questionId) === String(data.questionId))
  const node = existing || createUserInputNode({ ...data, seq })
  Object.assign(node, data, { kind: 'user_input', seq: Number(seq || node.seq || 0), updatedAt: Date.now() })
  if (!existing) nodes.push(node)
  msg.userInputRequest = node
  state.pendingUserInput = node.status === 'pending' ? node : null
  state.sending = false
  transitionStatus(state, 'waiting_for_user', 'user-input-requested')
  patchRuntime(msg, { phase: 'waiting_for_user', status: 'waiting_for_user' })
}

/** reply 事件 → seal live text/narration, set final text node if none collected */
function nodeAdaptReply(msg, finalText) {
  if (!msg) return
  const nodes = ensureNodes(msg)
  sealLiveTextOrNarration(nodes)

  if (!finalText || !finalText.trim()) return

  const last = nodes[nodes.length - 1]
  const visibleNodes = nodes.filter((n) => n.kind === 'text' || n.kind === 'narration')
  const visibleCount = visibleNodes.length

  if (visibleCount === 0) {
    // No text segments collected during streaming — push final reply as narration
    nodes.push(createNarrationNode({ content: finalText.trim(), streaming: false }))
  } else if (visibleCount === 1 && (last?.kind === 'text' || last?.kind === 'narration')) {
    // Single trailing segment — overwrite with authoritative reply text
    last.content = finalText.trim()
  } else if (visibleCount > 1 && (last?.kind === 'text' || last?.kind === 'narration')) {
    // Multiple segments: finalText = all segments concatenated.
    // Use the last node's leading ~40 chars as anchor to find its position
    // in finalText, then take everything from there as authoritative.
    // Recovers any tail content that was truncated due to dropped delta events.
    const lastTrimmed = (last.content ?? '').trim()
    const anchor = lastTrimmed.slice(0, 40)
    if (anchor) {
      const pos = finalText.lastIndexOf(anchor)
      if (pos !== -1) {
        const authoritative = finalText.slice(pos).trim()
        if (authoritative.length > lastTrimmed.length) {
          last.content = authoritative
        }
      }
    }
  }
  // visibleCount > 0 && last is tool/subtask at end:
  // text segments precede the last tool — no reliable way to extract post-tool
  // text from finalText without risking duplication; skip.
}

// ────────────────────────────────────────────────────────────────────
// 终态/恢复 helper
// ────────────────────────────────────────────────────────────────────

function applyTerminalRuntime(msg, status, patch = {}) {
  if (!msg || msg.role !== 'assistant') return
  msg.loading = false
  if (!msg.completedAt) msg.completedAt = Date.now()
  patchRuntime(msg, { phase: status, status, ...patch })
}

function applyFinalReplyText(msg, value) {
  const finalText = String(value ?? '').trim()
  if (finalText) {
    msg.content = finalText
  } else if (!String(msg.content || '').trim()) {
    const contentFromNodes = (msg.nodes || [])
      .filter((node) => node.kind === 'text' || node.kind === 'narration')
      .map((node) => node.content || '')
      .join('')
      .trim()
    msg.content = contentFromNodes || '（空回复）'
  }
  return finalText || msg.content
}

function completeAssistantTurn(state, msg, finalText, transitionReason) {
  msg.loading = false
  msg.completedAt = Date.now()
  patchRuntime(msg, { phase: 'completed', status: 'completed' })
  transitionStatus(state, 'completed', transitionReason)
  nodeAdaptReply(msg, finalText)
}

function ensureAssistantTurnForRecovery(state) {
  const idx = state.messages.length - 1
  const tail = state.messages[idx]
  if (tail?.role === 'assistant' && (tail.loading || !String(tail.content ?? '').trim())) {
    return tail
  }
  const msg = createAssistantMessage({
    runtime: { phase: 'recovering', status: state.status || 'running' }
  })
  state.messages.push(msg)
  return msg
}

// ────────────────────────────────────────────────────────────────────
// 事件 handlers：每个事件类型一个函数
// 形如 (ctx, event) => boolean；ctx 由 dispatcher 注入
// ────────────────────────────────────────────────────────────────────

/**
 * needsMsg：是否需要先解析 assistant 消息；若 true 且无法解析则跳过事件
 * recoverIfMissing：解析时若不存在是否自动创建（recovery 路径用）
 */
const EVENT_HANDLERS = {
  'turn/started': {
    needsMsg: false,
    fn: ({ state, resolveMsg }, { data }) => {
      const turn = data?.turn ?? data
      if (!turn?.id) return false
      const items = Array.isArray(turn.items) ? turn.items : []
      const userItem = items.find(item => item?.role === 'user')
      const assistantItem = items.find(item => item?.role === 'assistant')
      state.activeTurnId = String(turn.id)
      state.queuedTurnIds = (state.queuedTurnIds || [])
        .filter(id => String(id) !== String(turn.id))
      state.activeItemId = assistantItem?.id ? String(assistantItem.id) : state.activeItemId
      state.activeClientUserMessageId = turn.clientUserMessageId || state.activeClientUserMessageId || null
      if (turn.answerToQuestionId) {
        const answeredId = String(turn.answerToQuestionId)
        for (const message of state.messages) {
          for (const node of (message?.nodes || [])) {
            if (node?.kind === 'user_input' && String(node.questionId) === answeredId) {
              node.status = 'answered'
              node.updatedAt = Date.now()
            }
          }
        }
        if (String(state.pendingUserInput?.questionId || '') === answeredId) {
          state.pendingUserInput = null
        }
      }
      state.interrupting = !!turn.interruptRequested
      state.sending = true
      const status = turn.status === 'inProgress' ? 'running' : (turn.status || 'running')
      transitionStatus(state, status, 'turn-started')
      const msg = resolveMsg(false)
      if (msg) {
        if (state.activeItemId) msg.id = state.activeItemId
        msg.turnId = state.activeTurnId
        patchRuntime(msg, {
          turnId: state.activeTurnId,
          status: state.status,
          phase: status
        })
      }
      const userMsg = turn.answerToQuestionId ? null : [...state.messages].reverse().find(message =>
        message?.role === 'user' && (!message.turnId || message.turnId === state.activeTurnId))
      if (userMsg) {
        if (userItem?.id) userMsg.id = String(userItem.id)
        userMsg.turnId = state.activeTurnId
      }
      return true
    }
  },

  'turn/completed': {
    needsMsg: false,
    fn: ({ state, resolveMsg }, { data }) => {
      const turn = data?.turn ?? data
      if (!turn?.id) return false
      const status = turn.status === 'interrupted'
        ? 'cancelled'
        : (turn.status === 'inProgress' ? 'running' : turn.status)
      // queued Turn 可以在另一个 Turn 运行时被取消：只收口对应消息和队列项，
      // 不得覆盖当前 active Turn 的线程级状态。
      if (state.activeTurnId && String(turn.id) !== String(state.activeTurnId)) {
        const queued = (state.queuedTurnIds || [])
          .some(id => String(id) === String(turn.id))
        if (!queued) return false
        const queuedMsg = resolveMsg(false)
        state.queuedTurnIds = state.queuedTurnIds
          .filter(id => String(id) !== String(turn.id))
        if (queuedMsg) {
          applyTerminalRuntime(queuedMsg, status, {
            turnId: String(turn.id),
            interruptRequested: !!turn.interruptRequested
          })
          if (status === 'cancelled' && !String(queuedMsg.content || '').trim()) {
            queuedMsg.content = '（已取消）'
          }
        }
        return true
      }
      const msg = resolveMsg(false)
      const hasPendingInput = !!state.pendingUserInput
      const effectiveStatus = status === 'completed' && hasPendingInput
        ? 'waiting_for_user'
        : status
      transitionStatus(state, effectiveStatus, 'turn-completed')
      state.interrupting = false
      if (status !== 'running') {
        state.sending = false
        state.activeTurnId = null
        state.activeItemId = null
        state.activeClientUserMessageId = null
      }
      if (msg) {
        applyTerminalRuntime(msg, effectiveStatus, {
          turnId: String(turn.id),
          interruptRequested: !!turn.interruptRequested
        })
        if (status === 'failed') {
          msg.failed = true
          msg.errorMeta = turn.error || msg.errorMeta || null
        }
        if (status === 'cancelled' && !String(msg.content || '').trim()) {
          // 优先从停止前已接收的 text/narration 节点回填正文。
          applyFinalReplyText(msg, '')
          if (msg.content === '（空回复）') msg.content = '（已取消）'
        } else if (status === 'failed' && !String(msg.content || '').trim()) {
          applyFinalReplyText(msg, turn.error?.message)
        }
        sealLiveTextOrNarration(ensureNodes(msg))
      }
      state.queuedTurnIds = (state.queuedTurnIds || [])
        .filter(id => String(id) !== String(turn.id))
      if (status !== 'running' && !hasPendingInput && state.queuedTurnIds.length > 0) {
        state.sending = true
        transitionStatus(state, 'queued', 'queued-turn-remains')
      }
      return true
    }
  },

  trace: {
    needsMsg: false,
    fn: ({ state, resolveMsg }, { data }) => {
      if (!data || typeof data !== 'object') return false
      state.activeTrace = {
        ...(state.activeTrace || {}),
        ...data
      }
      const msg = resolveMsg(false)
      if (msg) {
        patchRuntime(msg, {
          traceId: data.traceId || msg.runtime?.traceId || null,
          turnId: data.turnId || msg.runtime?.turnId || null,
          runId: data.runId || msg.runtime?.runId || null
        })
      }
      return true
    }
  },

  status: {
    needsMsg: false,
    fn: ({ state, resolveMsg }, { data }) => {
      if (typeof data === 'string') {
        const status = normalizeAiStatus(data)
        transitionStatus(state, status, 'sse-status')
        if (status === 'waiting_for_user') state.sending = false
      }
      const msg = resolveMsg(false)
      if (msg) patchRuntime(msg, { status: state.status })
      return true
    }
  },

  phase: {
    needsMsg: true,
    fn: ({ state, msg }, { data }) => {
      const phase = typeof data === 'string' ? data : data?.phase
      patchRuntime(msg, { phase: phase || msg.runtime?.phase || 'running', status: state.status })
      return true
    }
  },

  thinking: {
    needsMsg: true,
    fn: ({ state, msg }, { data, seq }) => {
      patchRuntime(msg, { phase: 'thinking', status: state.status })
      nodeAdaptThinking(msg, data, seq)
      return true
    }
  },

  plan: {
    needsMsg: true,
    fn: ({ state, msg }, { data, seq }) => {
      msg.plan = normalizePlan(data, seq)
      patchRuntime(msg, { phase: 'planning', status: state.status })
      // Seal any preceding live text before the plan boundary
      sealLiveTextOrNarration(ensureNodes(msg))
      return true
    }
  },

  plan_step: {
    needsMsg: true,
    fn: ({ state, msg }, { data, seq, timestamp }) => {
      if (!Array.isArray(msg.planEvents)) msg.planEvents = []
      msg.planEvents.push({ ...data, seq, timestamp })
      if (msg.plan && Array.isArray(msg.plan.steps)) {
        const index = Number(data?.stepIndex)
        const step = msg.plan.steps.find((item) => Number(item?.index) === index)
        if (step) {
          if (typeof data?.status === 'string') {
            step.status = normalizePlanStepStatus(data.status)
          }
          if (typeof data?.result === 'string' && data.result.trim()) step.result = data.result
          if (typeof data?.reason === 'string' && data.reason.trim()) step.reason = data.reason
          if (typeof data?.action === 'string') step.action = data.action
          step.updatedAt = timestamp
        }
        msg.plan.updatedAt = timestamp
      }
      patchRuntime(msg, {
        phase: msg.runtime?.phase || 'planning',
        status: state.status,
        lastPlanAction: typeof data?.action === 'string' ? data.action : msg.runtime?.lastPlanAction || null,
        lastPlanStepIndex: Number.isFinite(Number(data?.stepIndex))
          ? Number(data.stepIndex)
          : msg.runtime?.lastPlanStepIndex ?? null
      })
      return true
    }
  },

  progress: {
    needsMsg: true,
    fn: ({ state, msg }, { data, seq }) => {
      patchRuntime(msg, { phase: 'responding', status: state.status })
      nodeAdaptProgress(msg, data, seq)
      return true
    }
  },

  delta: {
    needsMsg: true,
    fn: ({ state, msg }, { data }) => {
      msg.loading = true
      patchRuntime(msg, { phase: 'responding', status: state.status })
      nodeAdaptDelta(msg, String(data ?? ''))
      return true
    }
  },

  warn: {
    needsMsg: false,
    fn: ({ state }, { data, timestamp }) => {
      state.messages.push({ role: 'system-warn', content: data, timestamp })
      return true
    }
  },

  heartbeat: {
    needsMsg: false,
    fn: ({ state, resolveMsg }, { data }) => {
      state.lastHeartbeatAt = Date.now()
      state.heartbeat = data
      const msg = resolveMsg(false)
      if (!msg) return true
      if (data && typeof data === 'object') {
        if (typeof data.status === 'string') transitionStatus(state, data.status, 'heartbeat')
        patchRuntime(msg, {
          phase: 'heartbeat',
          status: state.status,
          elapsedMs: Number(data.elapsedMs || 0),
          taskTimeoutAt: data.taskTimeoutAt || null,
          stopReason: data.stopReason || null,
          lastSeq: Number(data.lastSeq || 0),
          lastHeartbeatAt: state.lastHeartbeatAt
        })
      } else {
        patchRuntime(msg, {
          phase: 'heartbeat',
          status: state.status,
          lastHeartbeatAt: state.lastHeartbeatAt
        })
      }
      return true
    }
  },

  error_meta: {
    needsMsg: true,
    fn: ({ msg }, { data }) => {
      msg.errorMeta = data
      return true
    }
  },

  review: {
    needsMsg: true,
    fn: ({ msg }, { data }) => {
      msg.review = data
      return true
    }
  },

  usage: {
    needsMsg: true,
    fn: ({ msg }, { data }) => {
      msg.usage = data
      patchRuntime(msg, {
        usage: data,
        finishReason: data?.finishReason || msg.runtime?.finishReason || null
      })
      return true
    }
  },

  reply: {
    needsMsg: true,
    fn: ({ state, msg }, { data }) => {
      const finalText = applyFinalReplyText(msg, data)
      completeAssistantTurn(state, msg, finalText, 'sse-reply')
      return true
    }
  },

  // ── 新 Task Tree 原生事件 ────────────────────────────────────────────

  /**
   * node 事件：在 Task Tree 中创建新节点。
   * kind 字段决定节点类型：thinking | text | tool | plan
   */
  node: {
    needsMsg: true,
    fn: ({ state, msg }, { data, seq }) => {
      const kind = data?.kind
      if (kind === 'thinking') {
        patchRuntime(msg, { phase: 'thinking', status: state.status })
        nodeAdaptThinking(msg, data, seq)
      } else if (kind === 'text') {
        // text 段闭合：用 authoritative 文本替换尾部 live narration，再 seal。
        patchRuntime(msg, { phase: 'responding', status: state.status })
        nodeAdaptTextSegment(msg, data, seq)
      } else if (kind === 'tool') {
        patchRuntime(msg, { phase: 'tool_running', status: state.status, lastToolName: data?.toolName })
        nodeAdaptTool(msg, data?.toolName ?? 'tool', data, seq)
      } else if (kind === 'plan') {
        msg.plan = normalizePlan(data, seq)
        patchRuntime(msg, { phase: 'planning', status: state.status })
        sealLiveTextOrNarration(ensureNodes(msg))
      } else if (kind === 'subtask') {
        nodeAdaptSubtask(msg, data, seq)
      } else if (kind === 'user_input') {
        nodeAdaptUserInput(state, msg, data, seq)
      }
      return true
    }
  },

  /**
   * patch 事件：更新 Task Tree 中的已有节点。
   * kind 字段决定目标节点类型：tool | plan | subtask
   */
  patch: {
    needsMsg: true,
    fn: ({ state, msg }, { data, seq }) => {
      const kind = data?.kind
      if (kind === 'tool') {
        // 工具执行完毕（含成功/失败）
        const phase = data?.success === false ? 'tool_failed' : 'tool'
        patchRuntime(msg, { phase, status: state.status, lastToolName: data?.toolName })
        nodeAdaptTool(msg, data?.toolName ?? 'tool', data, seq)
      } else if (kind === 'plan') {
        if (data?.stepIndex != null) {
          // 步骤级更新（原 plan_step 行为）
          if (!Array.isArray(msg.planEvents)) msg.planEvents = []
          msg.planEvents.push({ ...data, seq })
          if (msg.plan && Array.isArray(msg.plan.steps)) {
            const index = Number(data.stepIndex)
            const step = msg.plan.steps.find((item) => Number(item?.index) === index)
            if (step) {
              if (typeof data?.status === 'string') step.status = normalizePlanStepStatus(data.status)
              if (typeof data?.result === 'string' && data.result.trim()) step.result = data.result
              if (typeof data?.reason === 'string' && data.reason.trim()) step.reason = data.reason
              if (typeof data?.action === 'string') step.action = data.action
              step.updatedAt = data.timestamp || Date.now()
            }
            msg.plan.updatedAt = data.timestamp || Date.now()
          }
          patchRuntime(msg, {
            phase: msg.runtime?.phase || 'planning',
            status: state.status,
            lastPlanAction: typeof data?.action === 'string' ? data.action : msg.runtime?.lastPlanAction || null,
            lastPlanStepIndex: Number.isFinite(Number(data?.stepIndex))
              ? Number(data.stepIndex)
              : msg.runtime?.lastPlanStepIndex ?? null
          })
        } else {
          // 计划整体更新（原 plan 事件的 patch 路径）
          msg.plan = normalizePlan(data, seq)
          patchRuntime(msg, { phase: 'planning', status: state.status })
          sealLiveTextOrNarration(ensureNodes(msg))
        }
      } else if (kind === 'subtask') {
        nodeAdaptSubtask(msg, data, seq)
      }
      return true
    }
  },

  subagent_event: {
    needsMsg: true,
    fn: ({ state, msg }, { data, seq }) => {
      patchRuntime(msg, { phase: 'subtask_running', status: state.status })
      nodeAdaptSubtaskEvent(msg, data, seq)
      return true
    }
  },

  /**
   * turn 事件：轮次结束，合并 content + usage + review。
   * 取代旧的 reply + usage + review 三连事件。
   */
  turn: {
    needsMsg: true,
    fn: ({ state, msg }, { data }) => {
      const finalText = String(data?.content ?? '').trim()
      if (finalText) msg.content = finalText
      msg.loading = true
      patchRuntime(msg, {
        phase: 'model_completed',
        status: state.status
      })
      // 应用 usage
      const usage = data?.usage
      if (usage && typeof usage === 'object') {
        msg.usage = usage
        patchRuntime(msg, {
          usage,
          finishReason: usage?.finishReason || msg.runtime?.finishReason || null
        })
      }
      // 应用 review
      const review = data?.review
      if (review) msg.review = review
      if (data?.trace && typeof data.trace === 'object') {
        state.activeTrace = {
          ...(state.activeTrace || {}),
          ...data.trace
        }
        patchRuntime(msg, {
          traceId: data.trace.traceId || msg.runtime?.traceId || null,
          turnId: data.trace.turnId || msg.runtime?.turnId || null,
          runId: data.trace.runId || msg.runtime?.runId || null
        })
      }
      // turn 仅是模型结果聚合事件；控制协议终态只由 turn/completed 决定。
      nodeAdaptReply(msg, finalText)
      return true
    }
  }
}

// tool / tool_start / tool_delta 共用同一个 handler（仅 phase 不同）
const toolHandler = {
  needsMsg: true,
  fn: ({ state, msg }, { name, data, seq }) => {
    patchRuntime(msg, { phase: 'tool_preparing', status: state.status, lastToolName: data?.toolName })
    nodeAdaptTool(msg, data?.toolName ?? name, data, seq)
    return true
  }
}
EVENT_HANDLERS.tool_delta = toolHandler

// ────────────────────────────────────────────────────────────────────
// 主入口：dispatcher
// ────────────────────────────────────────────────────────────────────

export function createAiChatEventReducer({
  ensureState,
  getActiveKey,
  onVisibleEvent = () => {}
}) {
  const resolveAssistantMessage = (
    state,
    assistantIdx,
    createForRecovery = false,
    event = null
  ) => {
    const itemId = event?.itemId || state.activeItemId
    if (itemId) {
      const byItem = state.messages.find(message =>
        message?.role === 'assistant' && String(message.id || '') === String(itemId))
      if (byItem) return byItem
    }
    const turnId = event?.turnId || state.activeTurnId
    if (turnId) {
      const byTurn = state.messages.find(message =>
        message?.role === 'assistant' &&
        String(message.turnId || message.runtime?.turnId || '') === String(turnId))
      if (byTurn) return byTurn
    }
    if (assistantIdx != null) {
      const m = state.messages[assistantIdx]
      return m?.role === 'assistant' ? m : null
    }
    if (!createForRecovery) return null
    const created = ensureAssistantTurnForRecovery(state)
    if (itemId) created.id = String(itemId)
    if (turnId) {
      created.turnId = String(turnId)
      patchRuntime(created, { turnId: String(turnId) })
    }
    return created
  }

  const applyAiEvent = ({
    key = getActiveKey(),
    event,
    assistantIdx = null,
    createForRecovery = false
  } = {}) => {
    if (!event?.name) return false
    const state = ensureState(key)

    // 任何 SSE 事件都视为"活着"的证据，刷新 watchdog 锚点
    state.lastHeartbeatAt = Date.now()

    const seq = Number(event.seq || 0)
    if (seq && seq <= state.lastEventSeq) return false
    if (seq) state.lastEventSeq = seq

    const handler = EVENT_HANDLERS[event.name]
    if (!handler) return false

    const resolveMsg = (recover = createForRecovery) =>
      resolveAssistantMessage(state, assistantIdx, recover, event)
    const ctx = {
      state,
      key,
      resolveMsg,
      msg: handler.needsMsg ? resolveMsg(createForRecovery) : null
    }
    if (handler.needsMsg && !ctx.msg) return false

    const normalizedEvent = {
      name: event.name,
      data: event.data,
      turnId: event.turnId || event.data?.turn?.id || null,
      itemId: event.itemId || null,
      seq,
      timestamp: event.timestamp || Date.now()
    }
    return handler.fn(ctx, normalizedEvent) === true
  }

  const makeHandlers = (key, assistantIdx, createForRecovery) => {
    const dispatch = (name, data, seq, meta) => {
      applyAiEvent({
        key,
        assistantIdx,
        createForRecovery,
        event: { name, data, seq, ...(meta || {}) }
      })
      onVisibleEvent(key)
    }
    const dispatchSilent = (name, data, seq, meta) => {
      applyAiEvent({
        key,
        assistantIdx,
        createForRecovery,
        event: { name, data, seq, ...(meta || {}) }
      })
    }
    return {
      onEventSeq: (seq) => {
        const state = ensureState(key)
        const value = Number(seq || 0)
        if (Number.isFinite(value) && value > state.lastEventSeq) state.lastEventSeq = value
      },
      onThinking: (entry, seq, meta) => dispatch('thinking', { ...entry, seq }, seq, meta),
      onPhase: (phase, seq, meta) => dispatch('phase', phase, seq, meta),
      onToolDelta: (entry, seq, meta) => dispatch('tool_delta', { ...entry, seq }, seq, meta),
      onStatus: (status, seq, meta) => dispatchSilent('status', status, seq, meta),
      onDelta: (delta, seq, meta) => dispatch('delta', delta, seq, meta),
      onWarn: (text, seq, meta) => dispatch('warn', text, seq, meta),
      onHeartbeat: (payload, seq, meta) => dispatchSilent('heartbeat', payload, seq, meta),
      onErrorMeta: (data, seq, meta) => dispatchSilent('error_meta', data, seq, meta),
      onReview: (review, seq, meta) => dispatchSilent('review', review, seq, meta),
      onUsage: (usage, seq, meta) => dispatchSilent('usage', usage, seq, meta),
      onPlan: (plan, seq, meta) => dispatch('plan', plan, seq, meta),
      onPlanStep: (entry, seq, meta) => dispatch('plan_step', { ...entry, seq }, seq, meta),
      // 新 Task Tree 原生事件
      onNode: (data, seq, meta) => dispatch('node', data, seq, meta),
      onPatch: (data, seq, meta) => dispatch('patch', data, seq, meta),
      onSubagentEvent: (data, seq, meta) => dispatch('subagent_event', data, seq, meta),
      onTurn: (data, seq, meta) => dispatchSilent('turn', data, seq, meta),
      onTurnStarted: (data, seq, meta) => dispatchSilent('turn/started', data, seq, meta),
      onTurnCompleted: (data, seq, meta) => dispatchSilent('turn/completed', data, seq, meta),
      onTrace: (data, seq, meta) => dispatchSilent('trace', data, seq, meta)
    }
  }

  const makeLogHandlers = (key, assistantIdx) =>
    makeHandlers(key, assistantIdx, false)

  const makeRecoveryHandlers = (key) =>
    makeHandlers(key, null, true)

  const applyRecoveredEvents = ({
    key = getActiveKey(),
    events = [],
    runStatus,
    lastSeq,
    taskTimeoutAt,
    stopReason
  } = {}) => {
    const state = ensureState(key)
    const cursorBeforeReplay = Number(state.lastEventSeq || 0)
    const sortedEvents = Array.isArray(events)
      ? [...events].sort((a, b) => Number(a.seq || 0) - Number(b.seq || 0))
      : []

    for (const event of sortedEvents) {
      applyAiEvent({ key, event, createForRecovery: true })
    }

    let assistantMsg = resolveAssistantMessage(state, null, false, {
      itemId: state.activeItemId,
      turnId: state.activeTurnId
    }) || [...state.messages].reverse().find((msg) => msg?.role === 'assistant')
    const serverLastSeq = Number(lastSeq || 0)
    const replayedLastSeq = sortedEvents.reduce(
      (maximum, event) => Math.max(maximum, Number(event?.seq || 0)),
      cursorBeforeReplay
    )
    // lastSeq 是服务端当前最新事件序号，不是本页最后一条事件的游标。
    // 当积压事件超过单页 limit 时，直接写入 lastSeq 会永久跳过中间页。
    const hasReplayBacklog = replayedLastSeq > cursorBeforeReplay && serverLastSeq > replayedLastSeq

    // 后台虽然已经结束，但积压事件尚未重放完时不能提前进入终态，
    // 否则外层轮询会停止，最终回复及工具结果将不再进入页面。
    const canApplyRunStatus = runStatus &&
      !(hasReplayBacklog && TERMINAL_AI_STATUSES.includes(runStatus))
    if (canApplyRunStatus) {
      const normalizedRunStatus = normalizeAiStatus(runStatus)
      const status = transitionStatus(state, normalizedRunStatus, 'recovery')
      if (ACTIVE_AI_STATUSES.includes(status)) {
        state.sending = true
        assistantMsg = assistantMsg || ensureAssistantTurnForRecovery(state)
      }
      if (TERMINAL_AI_STATUSES.includes(status) && assistantMsg) {
        state.sending = false
        applyTerminalRuntime(assistantMsg, status, {
          taskTimeoutAt: taskTimeoutAt || null,
          stopReason: stopReason || null
        })
      }
      if (status === 'waiting_for_user') {
        state.sending = false
        if (assistantMsg) {
          applyTerminalRuntime(assistantMsg, status, {
            taskTimeoutAt: taskTimeoutAt || null,
            stopReason: stopReason || null
          })
        }
      }
      if (ACTIVE_AI_STATUSES.includes(status) && assistantMsg) {
        patchRuntime(assistantMsg, {
          status,
          taskTimeoutAt: taskTimeoutAt || assistantMsg.runtime?.taskTimeoutAt || null,
          stopReason: stopReason || null
        })
      }
    }

    return {
      cursor: Number(state.lastEventSeq || 0),
      serverLastSeq,
      hasMore: serverLastSeq > Number(state.lastEventSeq || 0)
    }
  }

  return {
    applyAiEvent,
    applyRecoveredEvents,
    applyTerminalRuntime,
    makeLogHandlers,
    makeRecoveryHandlers,
    /** Seal live node + apply authoritative reply text to nodes.
     *  Call from send() when the stream ends without a clean reply SSE event. */
    sealNodesWithReply: (msg, finalText) => nodeAdaptReply(msg, finalText)
  }
}
