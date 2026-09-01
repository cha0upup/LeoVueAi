export const resolvePuppetRuntimeStatus = ({
  puppet,
  sessions = [],
  isTesting = false,
  connectionResult = null
} = {}) => {
  const liveCount = Array.isArray(sessions) ? sessions.length : 0
  if (liveCount) return { status: 'online', label: `${liveCount} 会话` }
  if (isTesting) return { status: 'running', label: '测试中' }
  if (connectionResult) {
    return connectionResult.success
      ? { status: 'success', label: '成功' }
      : { status: 'failed', label: '失败' }
  }
  return puppet?.connLink
    ? { status: 'untested', label: '未测试' }
    : { status: 'offline', label: '离线' }
}
