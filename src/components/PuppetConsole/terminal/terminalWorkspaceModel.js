export function createTerminalSession({ id, title, hostSessionId, now = Date.now() }) {
  return {
    id,
    title,
    hostSessionId,
    pendingWrites: 0,
    writeChain: Promise.resolve(),
    readPromise: null,
    readErrorCount: 0,
    nextReadTime: 0,
    isLoading: false,
    lastActivityTime: now,
    lastPollTime: 0,
    hasUnread: false,
    viewportReady: false,
    initializing: false,
    initPromise: null,
    resizeTimer: null,
    cols: 80,
    rows: 24,
    pty: null,
    resizable: null,
    backend: 'detecting',
    backendFailures: [],
    longPolling: false,
    ended: false,
    endReason: '',
    endNoticeShown: false,
    instanceId: '',
    routingMismatch: false,
    routingWarningShown: false,
    disposed: false
  }
}

export function describeTerminalCapability(session) {
  const backend = session?.backend || 'detecting'
  const failures = Array.isArray(session?.backendFailures)
    ? session.backendFailures.filter(Boolean).map(String)
    : []

  if (session?.ended) {
    return {
      mode: 'ENDED',
      resizeMode: 'N/A',
      streamMode: 'STOPPED',
      shellLabel: 'SHELL ENDED',
      hint: session.endReason || '终端进程已结束',
      details: '创建新终端后可继续操作',
      degraded: true
    }
  }

  if (session?.pty === true) {
    const resizable = session.resizable !== false
    return {
      mode: 'PTY',
      resizeMode: resizable ? 'RESIZE' : 'FIXED',
      streamMode: session.longPolling ? 'LONG-POLL' : 'POLL',
      shellLabel: 'PTY SHELL',
      hint: `${resizable ? '完整交互' : '交互模式（固定尺寸）'} · ${backend}`,
      details: `终端后端：${backend}`,
      degraded: false
    }
  }

  if (session?.pty === false) {
    const failureText = failures.length ? `；PTY 启动记录：${failures.join('；')}` : ''
    return {
      mode: 'PIPE',
      resizeMode: 'FIXED',
      streamMode: session.longPolling ? 'LONG-POLL' : 'POLL',
      shellLabel: 'PIPE SHELL',
      hint: `兼容模式 · ${backend}`,
      details: `当前使用固定尺寸管道终端，全屏程序和作业控制可能受限${failureText}`,
      degraded: true
    }
  }

  return {
    mode: 'DETECTING',
    resizeMode: 'WAIT',
    streamMode: 'WAIT',
    shellLabel: 'SHELL DETECTING',
    hint: '正在协商终端能力',
    details: '终端初始化完成后显示实际 PTY 或 PIPE 后端',
    degraded: false
  }
}

export function formatTerminalRelativeTime(timestamp, now = Date.now()) {
  if (!timestamp) return '--'
  const delta = Math.max(0, now - timestamp)
  if (delta < 5000) return '刚刚'
  if (delta < 60000) return `${Math.floor(delta / 1000)} 秒前`
  if (delta < 3600000) return `${Math.floor(delta / 60000)} 分钟前`
  return `${Math.floor(delta / 3600000)} 小时前`
}

export function decodeTerminalOutput(response) {
  const payload = response?.data
  const encoded = payload && typeof payload === 'object' ? payload.data : payload
  if (typeof encoded !== 'string' || !encoded) return ''
  try {
    return new TextDecoder('utf-8').decode(
      Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0))
    )
  } catch {
    return ''
  }
}
