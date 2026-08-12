import {
  createNarrationNode,
  createSubtaskNode,
  createTextNode,
  createThinkingNode,
  createToolNode,
  createUserInputNode
} from '@/composables/aiTurnModel.js'
import { normalizeAiStatus } from '@/utils/aiRuntime.js'

export const getPlatformThreadStatus = (thread, conversationStatus = {}) => {
  const local = conversationStatus?.[thread?.threadId]
  return normalizeAiStatus(local?.status || thread?.runStatus || 'idle')
}

export const findLatestAssistantPlan = messages =>
  [...(Array.isArray(messages) ? messages : [])]
    .reverse()
    .find(message => message?.role === 'assistant')?.plan || null

const normalizeTimestamp = value => {
  const numeric = Number(value)
  if (Number.isFinite(numeric) && numeric > 0) return numeric
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : Date.now()
}

const mergePatch = (target, patch, immutableKeys) => {
  Object.entries(patch).forEach(([key, value]) => {
    if (!immutableKeys.includes(key) && value != null) target[key] = value
  })
}

const mapAssistantNodes = message => {
  const toolNodes = new Map()
  const subtaskNodes = new Map()
  const ordered = []
  let hasTextSegment = false

  ;(Array.isArray(message?.nodes) ? message.nodes : []).forEach((item, index) => {
    if (item?.kind === 'thinking' || item?.kind === 'text' || item?.kind === 'user_input') {
      hasTextSegment ||= item.kind === 'text'
      ordered.push({ kind: item.kind, seq: item.seq, index, item })
      return
    }
    if (item?.kind === 'tool') {
      const key = item.toolCallId
      const existing = key ? toolNodes.get(key) : null
      if (existing) {
        mergePatch(existing, item, ['kind', 'seq', 'toolCallId'])
      } else {
        const merged = { ...item }
        if (key) toolNodes.set(key, merged)
        ordered.push({ kind: 'tool', seq: item.seq, index, item: merged })
      }
      return
    }
    if (item?.kind !== 'subtask') return
    const key = item.subagentInvocationId
    const existing = key ? subtaskNodes.get(key) : null
    if (existing) {
      mergePatch(existing, item, ['kind', 'seq', 'subagentInvocationId'])
    } else {
      const merged = { ...item }
      if (key) subtaskNodes.set(key, merged)
      ordered.push({ kind: 'subtask', seq: item.seq, index, item: merged })
    }
  })

  ordered.sort((left, right) => {
    const sequenceDifference = Number(left.seq ?? 0) - Number(right.seq ?? 0)
    return sequenceDifference || left.index - right.index
  })

  const nodes = ordered.flatMap(entry => {
    const item = entry.item
    if (entry.kind === 'thinking') {
      return [createThinkingNode({ content: item.content ?? '', seq: entry.seq })]
    }
    if (entry.kind === 'text') {
      const content = String(item.content ?? '').trim()
      return content ? [createTextNode({ content, streaming: false, seq: entry.seq })] : []
    }
    if (entry.kind === 'user_input') {
      return [createUserInputNode({ ...entry.item, seq: entry.seq })]
    }
    if (entry.kind === 'subtask') {
      return [createSubtaskNode({
        invocationId: item.subagentInvocationId,
        childThreadId: item.childThreadId,
        sessionId: item.sessionId,
        puppetId: item.puppetId,
        task: item.task,
        status: item.status,
        summary: item.summary,
        seq: item.seq,
        createdAt: item.createdAt,
        completedAt: item.completedAt
      })]
    }
    const status = item.success != null
      ? item.success === false ? 'failed' : 'done'
      : item.status === 'running' ? 'running' : 'done'
    return [createToolNode({
      name: item.toolName ?? '',
      toolCallId: item.toolCallId ?? null,
      args: item.arguments ?? null,
      status,
      result: item.resultPreview ?? null,
      success: item.success ?? null,
      seq: item.seq,
      startTime: item.startTime ?? item.timestamp ?? null,
      endTime: item.endTime ?? null
    })]
  })

  const content = String(message?.content ?? '').trim()
  if (!hasTextSegment && content) nodes.push(createNarrationNode({ content, streaming: false }))
  return { content, nodes }
}

const persistedRuntimeStatus = message => {
  const protocolStatus = String(message?.protocolStatus || '').trim()
  if (protocolStatus === 'failed') return 'failed'
  if (protocolStatus === 'interrupted') return 'cancelled'
  if (message?.runStatus === 'failed') return 'failed'
  if (message?.runStatus === 'cancelled') return 'cancelled'
  if (message?.runStatus === 'completed') return 'completed'
  if (message?.runStatus === 'running') return 'running'
  if (protocolStatus === 'completed') return 'completed'
  if (protocolStatus === 'inProgress') {
    return message?.dispatchStatus === 'queued'
      ? 'queued'
      : message?.dispatchStatus === 'cancelling'
        ? 'cancelling'
        : 'running'
  }
  if (message?.status === 'pending') return 'running'
  return message?.status === 'committed' ? 'completed' : 'cancelled'
}

export const mapPlatformPersistedMessages = serverMessages => {
  const messages = Array.isArray(serverMessages) ? serverMessages : []
  const answeredQuestionIds = new Set(messages
    .map(message => message?.answerToQuestionId)
    .filter(Boolean)
    .map(String))
  const answersByQuestionId = new Map()
  messages.forEach(message => {
    if (message?.role !== 'user' || !message.answerToQuestionId) return
    const answeredId = String(message.answerToQuestionId)
    answersByQuestionId.set(answeredId, String(message.content || ''))
  })
  const retryTextByTurn = new Map(messages
    .filter(message => message?.role === 'user' && message?.turnId)
    .map(message => [message.turnId, message.content ?? '']))
  return messages.map(message => {
    const timestamp = normalizeTimestamp(message?.timestamp)
    if (message?.role === 'user') {
      if (message.answerToQuestionId) return null
      return {
        id: message.messageId || null,
        turnId: message.turnId || null,
        role: 'user',
        content: message.content ?? '',
        attachments: Array.isArray(message.attachments) ? message.attachments : [],
        timestamp
      }
    }
    if (message?.role === 'assistant') {
      const { content: persistedContent, nodes } = mapAssistantNodes(message)
      nodes.forEach(node => {
        if (node?.kind === 'user_input' && answeredQuestionIds.has(String(node.questionId))) {
          node.status = 'answered'
          node.answer ||= answersByQuestionId.get(String(node.questionId)) || null
        }
      })
      const runtimeStatus = persistedRuntimeStatus(message)
      const failed = runtimeStatus === 'failed'
      const content = persistedContent || (failed
        ? `调用失败：${message.protocolErrorMessage || '后台任务执行失败'}`
        : '')
      return {
        id: message.messageId || null,
        turnId: message.turnId || null,
        role: 'assistant',
        content,
        nodes,
        review: message.review && typeof message.review === 'object' ? message.review : null,
        loading: ['queued', 'running', 'cancelling'].includes(runtimeStatus),
        failed,
        retryText: failed ? retryTextByTurn.get(message.turnId) || null : null,
        answerToQuestionId: message.answerToQuestionId || null,
        errorMeta: failed && message.protocolErrorMessage
          ? { message: message.protocolErrorMessage }
          : null,
        startedAt: timestamp,
        completedAt: ['queued', 'running', 'cancelling'].includes(runtimeStatus)
          ? null
          : timestamp,
        runtime: {
          turnId: message.turnId || null,
          status: runtimeStatus,
          phase: runtimeStatus
        }
      }
    }
    return { role: 'system-warn', content: message?.content ?? '', timestamp }
  }).filter(Boolean)
}

export const buildRequestAttachments = attachments =>
  (Array.isArray(attachments) ? attachments : []).map(({ name, mimeType, size, content }) => ({
    name,
    mimeType,
    size,
    content
  }))
