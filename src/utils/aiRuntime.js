export const TERMINAL_AI_STATUSES = ['completed', 'failed', 'cancelled']
export const ACTIVE_AI_STATUSES = ['queued', 'running', 'cancelling']
export const WAITING_AI_STATUSES = ['waiting_for_user']

export function normalizeAiStatus(status, fallback = 'idle') {
  if (status === 'done') return 'completed'
  if (status === 'stopped') return 'cancelled'
  if (status === 'interrupted') return 'cancelled'
  if (status === 'inProgress') return 'running'
  if (status === 'waitingForUser') return 'waiting_for_user'
  return status || fallback
}

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
