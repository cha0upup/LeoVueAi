import {
  createNarrationNode,
  createTextNode,
  createThinkingNode,
  createToolNode,
  createUserInputNode
} from '@/composables/aiTurnModel.js'
import { normalizeAiStatus } from '@/utils/aiRuntime.js'

export const getThreadTabStatus = (thread, conversationStatus = {}) => {
  const local = conversationStatus?.[thread?.threadId]
  return normalizeAiStatus(local?.status || thread?.runStatus || 'idle')
}

export const findLatestAssistantPlan = messages =>
  [...(Array.isArray(messages) ? messages : [])]
    .reverse()
    .find(message => message?.role === 'assistant')?.plan || null

const mapAssistantNodes = message => {
  const rawNodes = Array.isArray(message?.nodes) ? message.nodes : []
  const toolByCallId = new Map()
  const ordered = []
  let hasTextSegment = false

  rawNodes.forEach((item, index) => {
    if (item?.kind === 'thinking' || item?.kind === 'text' || item?.kind === 'user_input') {
      if (item.kind === 'text') hasTextSegment = true
      ordered.push({ kind: item.kind, seq: item.seq, index, item })
      return
    }
    if (item?.kind !== 'tool') return
    const toolCallId = item.toolCallId
    const existing = toolCallId ? toolByCallId.get(toolCallId) : null
    if (existing) {
      Object.entries(item).forEach(([key, value]) => {
        if (!['kind', 'seq', 'toolCallId'].includes(key) && value != null) existing[key] = value
      })
      return
    }
    const merged = { ...item }
    if (toolCallId) toolByCallId.set(toolCallId, merged)
    ordered.push({ kind: 'tool', seq: item.seq, index, item: merged })
  })

  ordered.sort((left, right) => {
    const seqDifference = Number(left.seq ?? 0) - Number(right.seq ?? 0)
    return seqDifference || left.index - right.index
  })

  const nodes = ordered.flatMap(entry => {
    if (entry.kind === 'thinking') {
      return [createThinkingNode({ content: entry.item.content ?? '', seq: entry.seq })]
    }
    if (entry.kind === 'text') {
      const content = String(entry.item.content ?? '').trim()
      return content ? [createTextNode({ content, streaming: false, seq: entry.seq })] : []
    }
    if (entry.kind === 'user_input') {
      return [createUserInputNode({ ...entry.item, seq: entry.seq })]
    }
    const item = entry.item
    const status = item.success != null
      ? item.success === false ? 'failed' : 'done'
      : item.status === 'running' ? 'running' : 'done'
    return [createToolNode({
      name: item.toolName ?? '',
      toolCallId: item.toolCallId ?? null,
      args: item.arguments ?? null,
      toolKind: item.toolKind ?? null,
      businessTool: item.businessTool !== false,
      terminal: item.terminal === true,
      exclusive: item.exclusive === true,
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

export const mapPersistedThreadMessages = serverMessages => {
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
    const numericTimestamp = Number(message?.timestamp)
    const parsedTimestamp = Date.parse(message?.timestamp)
    const timestamp = Number.isFinite(numericTimestamp) && numericTimestamp > 0
      ? numericTimestamp
      : Number.isFinite(parsedTimestamp)
        ? parsedTimestamp
        : Date.now()
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
