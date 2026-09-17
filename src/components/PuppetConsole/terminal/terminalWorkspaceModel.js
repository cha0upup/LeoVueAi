import { isCommandTerminal } from './terminalProtocol.js'

export function createTerminalSession({
  id,
  title,
  hostSessionId,
  terminalMode = null,
  now = Date.now()
}) {
  return {
    id,
    title,
    hostSessionId,
    terminalMode,
    terminalModes: [],
    lastActivityTime: now,
    hasUnread: false,
    viewportReady: false,
    cols: 80,
    rows: 24,
    pty: null,
    resizable: null,
    backend: 'detecting',
    backendFailures: [],
    longPolling: false,
    batchRead: false,
    lineInput: false,
    processExited: false,
    ended: false,
    endReason: '',
    instanceId: '',
    routingMismatch: false
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
      details: `${session.endReason || '终端进程已结束'}；创建新终端后可继续操作`
    }
  }

  if (session?.pty === true) {
    const resizable = session.resizable !== false
    return {
      mode: 'PTY',
      resizeMode: resizable ? 'RESIZE' : 'FIXED',
      streamMode: session.longPolling ? 'LONG-POLL' : 'POLL',
      details: `终端后端：${backend}`
    }
  }

  if (session?.pty === false) {
    const failureText = failures.length ? `；PTY 启动记录：${failures.join('；')}` : ''
    if (isCommandTerminal(session)) {
      return {
        mode: 'COMMAND',
        resizeMode: 'FIXED',
        streamMode: 'POLL',
        details: `每条命令独立执行，单次提交最多运行 20 秒；环境变量不会跨命令保留，不支持交互式输入、历史方向键和全屏程序${failureText}`
      }
    }
    return {
      mode: 'PIPE',
      resizeMode: 'FIXED',
      streamMode: session.longPolling ? 'LONG-POLL' : 'POLL',
      details: `支持持续 shell 和工作目录；全屏程序、作业控制及 Ctrl+C 可能受限，可新建 Python PTY 终端${failureText}`
    }
  }

  return {
    mode: 'DETECTING',
    resizeMode: 'WAIT',
    streamMode: 'WAIT',
    details: '终端初始化完成后显示实际 PTY 或 PIPE 后端'
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

/** Monotonic process/EOF state; stale instance responses never mutate capability. */
export function applyTerminalMetadata(session, payload, fromRead = false) {
  const instanceId = typeof payload.instanceId === 'string' ? payload.instanceId : ''
  if (instanceId && session.instanceId && instanceId !== session.instanceId) {
    session.routingMismatch = true
    return false
  }
  if (instanceId) session.instanceId = instanceId
  session.routingMismatch = false
  for (const key of ['pty', 'resizable', 'longPolling', 'lineInput', 'batchRead']) {
    if (typeof payload[key] === 'boolean') session[key] = payload[key]
  }
  if (typeof payload.backend === 'string' && payload.backend) session.backend = payload.backend
  if (Array.isArray(payload.terminalModes)) session.terminalModes = payload.terminalModes
  if (Array.isArray(payload.backendFailures)) session.backendFailures = payload.backendFailures
  if (payload.missing === true) {
    session.processExited = true
    session.ended = true
    session.endReason = '终端会话记录已失效'
  } else if (payload.alive === false) {
    session.processExited = true
    session.endReason =
      payload.exitCode === null || payload.exitCode === undefined
        ? session.endReason || '终端进程已结束'
        : `终端进程已结束，退出码 ${payload.exitCode}`
  }
  if (fromRead && payload.eof === true) {
    session.processExited = true
    session.ended = true
    session.endReason ||= '终端进程已结束'
  }
  return true
}
