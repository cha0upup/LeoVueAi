export function resolvePuppetSessionEntry(sessions = []) {
  const activeSessions = Array.isArray(sessions) ? sessions.filter(Boolean) : []
  if (activeSessions.length === 1) {
    return { action: 'reuse', session: activeSessions[0], sessions: activeSessions }
  }
  if (activeSessions.length > 1) {
    return { action: 'choose', session: null, sessions: activeSessions }
  }
  return { action: 'create', session: null, sessions: [] }
}
