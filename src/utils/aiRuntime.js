export const TERMINAL_AI_STATUSES = ['completed', 'failed', 'cancelled']
export const ACTIVE_AI_STATUSES = ['queued', 'running', 'cancelling']

export function normalizeAiStatus(status, fallback = 'idle') {
  if (status === 'interrupted') return 'cancelled'
  return status || fallback
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

function formatRuntimeSeconds(seconds) {
  const safe = Math.max(0, Number(seconds) || 0)
  if (safe < 60) return `${safe}s`
  const minutes = Math.floor(safe / 60)
  const rest = safe % 60
  return `${minutes}m ${String(rest).padStart(2, '0')}s`
}

export function formatRuntimeMs(ms, { minSeconds = 1 } = {}) {
  const seconds = Math.max(minSeconds, Math.round(Math.max(0, Number(ms) || 0) / 1000))
  return formatRuntimeSeconds(seconds)
}
