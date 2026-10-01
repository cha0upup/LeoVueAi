import http from '../http.js'
import { fetchAiSse } from './ai-sse.js'

/** 仅创建并持久化 Turn，不等待执行或打开事件流。 */
export async function nodeAiStartTurnApi(params) {
  const response = await http.post('/agent-node/ai/turn/start', params)
  const turn = response?.data?.turn
  if (!turn?.id) throw new Error('Turn 创建响应缺少 id')
  return turn
}

/** 停止指定线程的 AI 执行（interrupt 后端线程 + 取消挂起确认）。 */
export function nodeAiStopApi(params) {
  return http.post('/agent-node/ai/turn/interrupt', params)
}

/** 热切换 AI 通道（保留 LLM 上下文）。 */
export function nodeAiSwitchChannelApi(params) {
  return http.post('/agent-node/ai/switchChannel', params)
}

// ─── 线程管理 ─────────────────────────────────────────────────────────────────

/** 列出当前 agent 的所有 AI 对话线程。 */
export function nodeAiThreadListApi(params) {
  return http.post('/agent-node/ai/thread/list', params)
}

/** 创建新的 AI 对话线程，返回 threadId、title、reconSummaryLoaded。 */
export function nodeAiThreadCreateApi(params) {
  return http.post('/agent-node/ai/thread/create', params)
}

/** 删除指定 AI 对话线程（内存 + 持久化）。 */
export function nodeAiThreadDeleteApi(params) {
  return http.post('/agent-node/ai/thread/delete', params)
}

/** 重命名指定 AI 对话线程。 */
export function nodeAiThreadRenameApi(params) {
  return http.post('/agent-node/ai/thread/rename', params)
}

/**
 * 加载指定线程的历史消息（分页）。
 * @param {object} params
 * @param {string} params.sessionId
 * @param {string} params.threadId
 * @param {number} [params.offset=0]
 * @param {number} [params.limit=50]
 */
export function nodeAiThreadMessagesApi(params) {
  return http.post('/agent-node/ai/thread/messages', params)
}

/**
 * 获取指定线程最近 SSE 事件，用于切换会话或断线后补看执行过程。
 * @param {object} params
 * @param {string} params.sessionId
 * @param {string} params.threadId
 * @param {number} [params.afterSeq=0]
 * @param {number} [params.limit=200]
 */
export async function nodeAiThreadEventsApi(params) {
  const { data } = await http.post('/agent-node/ai/thread/events', params)
  return data
}

/** 重新附着指定节点 AI 线程的可重放实时事件流。 */
export function nodeAiThreadStreamApi(params) {
  const {
    sessionId,
    threadId,
    afterSeq,
    signal,
    ...handlers
  } = params
  const base = http.defaults.baseURL || ''
  const url = `${base.replace(/\/$/, '')}/agent-node/ai/thread/stream`
  return fetchAiSse(url, { sessionId, threadId, afterSeq }, signal, handlers)
}
