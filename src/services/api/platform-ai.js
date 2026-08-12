import http from '../http.js'
import { fetchAiSse } from './ai-sse.js'

/**
 * 获取平台 AI 可用性。只返回是否存在可用通道，不暴露后台配置详情。
 */
export function platformAiAvailabilityApi() {
  return http.get('/platform/ai/availability')
}

/** 获取聊天组件可用的脱敏模型目录。 */
export function listAvailableAiModelsApi() {
  return http.get('/platform/ai/models')
}

/**
 * 初始化平台级 AI Agent（绑定到当前 HTTP Session）
 * 每次打开平台 AI 面板时调用一次即可
 * @param {Object} [params]
 * @param {number} [params.configId] - 可选，指定使用的 AI 通道 ID；不传则使用激活通道
 */
export async function platformAiCreateAgent(params) {
  return http.post('/platform/ai/createAgent', params || {})
}

/**
 * 热切换平台 AI 通道（保留对话历史）
 * @param {Object} [params]
 * @param {number} [params.configId] - 目标通道 ID；不传则切换到激活通道
 */
export function platformAiSwitchChannelApi(params) {
  return http.post('/platform/ai/switchChannel', params || {})
}

/**
 * 停止当前平台 AI 执行（interrupt 后端线程 + 取消挂起确认）。
 */
export function platformAiStopApi(params) {
  return http.post('/platform/ai/turn/interrupt', params)
}

/**
 * 获取当前平台 AI 最近 SSE 事件，用于流中断后的补拉恢复。
 */
export function platformAiEventsApi(params) {
  return http.post('/platform/ai/events', params || {})
}

/** 仅创建并持久化 Turn，不等待执行或打开事件流。 */
export async function platformAiStartTurnApi(params) {
  const response = await http.post('/platform/ai/turn/start', params)
  const turn = response?.data?.turn
  if (!turn?.id) throw new Error('Turn 创建响应缺少 id')
  return turn
}

/** 重新附着指定平台 AI 线程的可重放实时事件流。 */
export function platformAiStreamApi(params) {
  const {
    threadId,
    afterSeq,
    signal,
    ...handlers
  } = params
  const base = http.defaults.baseURL || ''
  const url = `${base.replace(/\/$/, '')}/platform/ai/stream`
  return fetchAiSse(url, { threadId, afterSeq }, signal, handlers)
}

/**
 * 加载当前平台 AI 会话的历史消息（分页）。
 * @param {Object} [params]
 * @param {number} [params.offset]
 * @param {number} [params.limit]
 */
export function platformAiMessagesApi(params) {
  return http.post('/platform/ai/messages', params || {})
}

// ── 线程管理 ──────────────────────────────────────────────────────────────

/**
 * 列出当前用户的所有平台 AI 线程。
 */
export function platformAiThreadsApi() {
  return http.post('/platform/ai/threads')
}

/**
 * 创建新线程。
 * @param {Object} [params]
 * @param {string} [params.title]
 * @param {number} [params.configId]
 */
export function platformAiThreadCreateApi(params) {
  return http.post('/platform/ai/thread/create', params || {})
}

/**
 * 删除指定线程。
 * @param {Object} params
 * @param {string} params.threadId
 */
export function platformAiThreadDeleteApi(params) {
  return http.post('/platform/ai/thread/delete', params)
}

/**
 * 重命名线程。
 * @param {Object} params
 * @param {string} params.threadId
 * @param {string} params.title
 */
export function platformAiThreadRenameApi(params) {
  return http.post('/platform/ai/thread/rename', params)
}

/**
 * 切换到指定线程。
 * @param {Object} params
 * @param {string} params.threadId
 */
export function platformAiThreadActivateApi(params) {
  return http.post('/platform/ai/thread/activate', params)
}
