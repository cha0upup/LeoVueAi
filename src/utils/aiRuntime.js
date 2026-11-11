export const TERMINAL_AI_STATUSES = ['completed', 'failed', 'cancelled']
export const ACTIVE_AI_STATUSES = ['queued', 'running', 'cancelling']

export function normalizeAiStatus(status, fallback = 'idle') {
  if (status === 'interrupted') return 'cancelled'
  return status || fallback
}

/** 两类 AI 共用恢复条件；服务端与本地任一侧有未收口状态都需要同步快照。 */
export function shouldRecoverAiConversation(thread, local = {}) {
  return [thread?.runStatus, local.status].some(value => {
    const status = normalizeAiStatus(value)
    return ACTIVE_AI_STATUSES.includes(status) || status === 'waiting_for_user'
  }) || Boolean(thread?.executing || thread?.pendingUserInput || local.pendingUserInput ||
    local.sending || local.recovering)
}

export const getThreadStatus = (thread, conversationStatus = {}) => {
  const localStatus = normalizeAiStatus(conversationStatus?.[thread?.threadId]?.status)
  if (localStatus && localStatus !== 'idle') return localStatus
  return normalizeAiStatus(thread?.runStatus)
}

export const isDefaultThreadTitle = title => !title?.trim() || /^(对话\s*\d+|新对话|未命名对话|平台\s*AI)$/.test(title.trim())

export const getThreadTitle = thread => isDefaultThreadTitle(thread?.title)
  ? (thread?.messageCount > 0 ? '未命名对话' : '新对话')
  : thread.title

export function formatRuntimeMs(ms, { minSeconds = 1 } = {}) {
  const seconds = Math.max(minSeconds, Math.round(Math.max(0, Number(ms) || 0) / 1000))
  const safe = Math.max(0, Number(seconds) || 0)
  if (safe < 60) return `${safe}s`
  const minutes = Math.floor(safe / 60)
  const rest = safe % 60
  return `${minutes}m ${String(rest).padStart(2, '0')}s`
}

/**
 * 格式化时间为时钟格式 (HH:mm)
 */
export function formatTurnClock(ts) {
  return typeof ts === 'number'
    ? new Date(ts).toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    : '--:--'
}

/**
 * 格式化处理耗时标签
 */
export function formatElapsedLabel(startedAt, completedAt) {
  if (typeof startedAt !== 'number') return '处理中'
  const end = typeof completedAt === 'number' ? completedAt : Date.now()
  const deltaMs = Math.max(0, end - startedAt)
  const seconds = Math.max(1, Math.round(deltaMs / 1000))
  return `已处理 ${seconds}s`
}
