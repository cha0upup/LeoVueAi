import { applyTerminalMetadata } from './terminalWorkspaceModel.js'
import { createTerminalInputQueue } from './createTerminalInputQueue.js'
import { createTerminalLineEditor } from './createTerminalLineEditor.js'
import { createTerminalOutputStream } from './createTerminalOutputStream.js'
import { requireTerminalSuccess } from '../../../services/terminalResponse.js'
import {
  createTerminalOutputDecoder,
  isCommandTerminal,
  normalizeTerminalSize,
  terminalNotice,
  TERMINAL_INTERRUPT,
  TERMINAL_POLLING,
  TERMINAL_RESIZE_DELAY
} from './terminalProtocol.js'

/** One remote process. No Vue or xterm dependency; async resources stay private. */
export function createTerminalSessionController({
  session,
  executeCommand,
  isCurrent = () => true,
  isForeground = () => true,
  onOutput = () => {},
  onActivity = () => {},
  onError = () => {},
  pollingConfig = {}
}) {
  const polling = { ...TERMINAL_POLLING, ...pollingConfig }
  const identity = { sessionId: session.hostSessionId, processId: session.id }
  let decodeOutput = createTerminalOutputDecoder()
  let disposed = false
  let initialization = null
  let closing = null
  let readPromise = null
  let resizeTimer = null
  let lastReadFinishedTime = 0
  let nextReadTime = 0
  let readErrors = 0
  let emptyReads = 0
  let activityVersion = 0
  let hasMoreOutput = false
  let endNoticeShown = false
  let wasForeground = true

  const current = () => !disposed && isCurrent()
  const canWrite = () =>
    current() && session.viewportReady && !session.processExited && !session.ended
  const canRead = () => current() && session.viewportReady && !session.ended
  const request = (type, cmd = '') => {
    const params = { ...identity, type, cmd }
    const mutating = type === 'init' || type === 'write' || type === 'write-line'
    if (type === 'init' && session.terminalMode) params.terminalMode = session.terminalMode
    if (type === 'read' && !cmd && session.batchRead) params.batchRead = true
    // While waiting for an earlier output response, keep input flowing without consuming more output.
    if (mutating && !outputStream.waiting) params.includeOutput = true
    const outputRequest = type === 'read' || params.includeOutput
    const startedAtActivity = activityVersion
    if (outputRequest) outputStream.begin()
    return Promise.resolve()
      .then(() => executeCommand(params))
      .then((response) => requireTerminalSuccess(response?.data))
      .then((payload) => {
        if (!outputRequest || !current()) return payload
        try {
          const output = type === 'read' ? payload : requireTerminalSuccess(payload.output)
          if (output.instanceId && session.instanceId && output.instanceId !== session.instanceId) {
            accept(output)
          } else {
            outputStream.push({ payload: output, startedAtActivity, fromWrite: type !== 'read' })
          }
        } catch (error) {
          if (type === 'read') throw error
          // The command succeeded; never turn an output error into a failed/retried write.
          handleReadError(error, false)
        }
        return payload
      })
      .finally(() => {
        if (outputRequest) {
          outputStream.finish()
          // Both explicit reads and write attachments start the next interval on completion.
          lastReadFinishedTime = Date.now()
        }
      })
  }
  const activity = () => {
    if (!current()) return
    emptyReads = 0
    activityVersion += 1
    session.lastActivityTime = Date.now()
    onActivity()
  }
  const writeNotice = (message, error = false) => {
    if (current()) onOutput(terminalNotice(message, error), false)
  }
  const showEndNotice = () => {
    if (!session.ended || endNoticeShown) return
    endNoticeShown = true
    writeNotice(`${session.endReason || '终端进程已结束'}，请创建新终端继续操作`)
  }
  const accept = (payload, fromRead = false) => {
    if (!current()) return false
    const wasMismatched = session.routingMismatch
    if (applyTerminalMetadata(session, payload, fromRead)) return true
    nextReadTime = Date.now() + polling.idleIntervals[0]
    if (!wasMismatched) {
      writeNotice('终端请求已切换到另一服务实例，请为终端接口启用会话粘性路由')
    }
    return false
  }

  const handleReadError = (error, silent) => {
    if (!current()) return
    readErrors += 1
    nextReadTime =
      Date.now() +
      Math.min(polling.errorMaxInterval, polling.errorBaseInterval * 2 ** (readErrors - 1))
    if (!silent) writeNotice(error.message || String(error), true)
  }
  const outputStream = createTerminalOutputStream({
    onError: (error) => handleReadError(error, false),
    consume: ({ payload, startedAtActivity, fromWrite }) => {
      if (!accept(payload, true)) return
      const output = decodeOutput(payload, session.ended)
      readErrors = 0
      nextReadTime = 0
      hasMoreOutput = payload.hasMore === true
      if (output) onOutput(output, true)
      if (payload.data || hasMoreOutput || session.processExited) activity()
      else if (!fromWrite && startedAtActivity === activityVersion) {
        emptyReads = Math.min(emptyReads + 1, polling.idleIntervals.length)
      }
      // A PHP command response already includes its final prompt. Resume idle polling.
      if (
        fromWrite &&
        isCommandTerminal(session) &&
        payload.busy === false &&
        !hasMoreOutput &&
        !session.processExited
      ) {
        emptyReads = Math.max(emptyReads, 1)
      }
      showEndNotice()
    },
    onGap: () => {
      decodeOutput = createTerminalOutputDecoder()
      writeNotice('部分终端输出响应未送达，已从后续输出继续显示', true)
    }
  })

  const read = (silent = false) => {
    if (!canRead()) return Promise.resolve()
    if (readPromise) return readPromise
    if (outputStream.waiting) return Promise.resolve()
    wasForeground = isForeground()
    const wait =
      session.longPolling && wasForeground && !session.processExited && !hasMoreOutput
        ? String(polling.longPollWait)
        : ''
    const pending = request('read', wait)
      .catch((error) => handleReadError(error, silent))
      .finally(() => {
        if (readPromise === pending) readPromise = null
      })
    readPromise = pending
    return pending
  }

  const poll = (now = Date.now()) => {
    if (!canRead() || readPromise) return
    const foreground = isForeground()
    const activated = foreground && !wasForeground
    wasForeground = foreground
    if (activated) return refresh()
    if (now < nextReadTime) return
    if (session.processExited || hasMoreOutput || readErrors) return read(true)
    // A foreground long poll already waits efficiently and returns on output.
    const idleInterval = emptyReads ? polling.idleIntervals[emptyReads - 1] : 0
    const interval = foreground
      ? session.longPolling
        ? 0
        : idleInterval
      : Math.max(polling.backgroundInterval, idleInterval)
    if (now - lastReadFinishedTime < interval) return
    return read(true)
  }

  const refresh = () => {
    if (!current() || !isForeground()) return Promise.resolve()
    activity()
    return read(true)
  }

  const resize = (size) => {
    if (!current()) return
    Object.assign(session, normalizeTerminalSize(size))
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      resizeTimer = null
      if (!canWrite() || session.resizable === false) return
      request('resize', `${session.cols},${session.rows}`)
        .then((payload) => accept(payload))
        .catch(() => {})
    }, TERMINAL_RESIZE_DELAY)
  }

  const initialize = () => {
    if (initialization) return initialization
    if (!current() || session.viewportReady || session.ended) return Promise.resolve(false)
    const pending = request('init')
      .then((payload) => {
        if (!accept(payload)) return false
        if (
          (session.terminalMode === 'pipe' && payload.pty === true) ||
          (session.terminalMode === 'python-pty' && payload.pty !== true)
        ) {
          throw new Error('节点未按所选模式启动终端')
        }
        session.viewportReady = true
        activity()
        resize(session)
        return !session.processExited && !session.ended
      })
      .catch((error) => {
        if (!current()) return false
        session.ended = true
        session.processExited = true
        session.endReason = `终端初始化失败: ${error.message || error}`
        stop()
        onError(session.endReason)
        return false
      })
      .finally(() => {
        if (initialization === pending) initialization = null
      })
    initialization = pending
    return pending
  }

  const lineEditor = createTerminalLineEditor()
  const handleInputError = (error) => {
    lineEditor.reset()
    writeNotice(error.message || String(error), true)
  }
  const sendInput = async (type, chunk) => {
    if (!canWrite()) return false
    return accept(await request(type, chunk))
  }
  const inputQueue = createTerminalInputQueue({
    send: sendInput,
    canWrite,
    onError: handleInputError
  })

  const write = async (chunk) => {
    if (!chunk || !current()) return false
    if (initialization) await initialization
    if (!current()) return false
    if (session.processExited || session.ended) {
      showEndNotice()
      return false
    }
    if (!canWrite()) return false
    activity()
    if (session.lineInput && session.pty === false) {
      const { data, output, error } = lineEditor.write(chunk)
      if (output) onOutput(output, false)
      if (error) {
        inputQueue.cancel()
        handleInputError(error)
        return false
      }
      return data ? inputQueue.write('write-line', data, true) : true
    }
    if (chunk === TERMINAL_INTERRUPT && isCommandTerminal(session)) {
      inputQueue.cancel()
      try {
        // PHP command writes wait for execution; interrupt must bypass that request.
        return await sendInput('write', chunk)
      } catch (error) {
        handleInputError(error)
        return false
      }
    }
    let immediate = false
    for (const character of chunk) {
      if (character < ' ' || character === '\x7f') {
        immediate = true
        break
      }
    }
    return inputQueue.write('write', chunk, immediate)
  }

  const stop = async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await request('stop')
        return
      } catch (error) {
        if (attempt === 2) {
          onError(`终端 ${session.title} 清理失败: ${error.message || error}`)
          return
        }
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)))
      }
    }
  }

  const dispose = () => {
    if (closing) return closing
    disposed = true
    inputQueue.cancel()
    lineEditor.reset()
    session.viewportReady = false
    clearTimeout(resizeTimer)
    resizeTimer = null
    decodeOutput = null
    outputStream.close()
    const pendingInit = initialization
    // Only init can create a process. Compensate if it reaches the node after stop.
    const stopping = stop()
    closing = pendingInit ? Promise.allSettled([stopping, pendingInit]).then(stop) : stopping
    return closing
  }

  return {
    initialize,
    write,
    poll,
    refresh,
    resize,
    dispose,
    activity,
    interrupt: () => write(TERMINAL_INTERRUPT),
    canRead
  }
}
