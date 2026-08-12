import { computed, nextTick, onScopeDispose, ref, watch } from 'vue'
import { v4 as uuidV4 } from 'uuid'
import {
  createTerminalSession,
  decodeTerminalOutput,
  formatTerminalRelativeTime
} from './terminalWorkspaceModel.js'

const DEFAULT_POLLING_CONFIG = Object.freeze({
  interval: 250,
  idleTimeout: 10000,
  idleInterval: 3000,
  longPollWait: 1000,
  errorBaseInterval: 1000,
  errorMaxInterval: 10000
})
const TERMINAL_RESIZE_DEBOUNCE = 120

export function useTerminalWorkspace({
  hostSessionId,
  executeCommand,
  createProcessId = uuidV4,
  pollingConfig = DEFAULT_POLLING_CONFIG,
  onError = () => {}
}) {
  const sessions = ref([])
  const activeSessionId = ref('')
  const searchKeyword = ref('')
  const sessionSeed = ref(1)
  const clockTick = ref(0)
  const viewportRefs = new Map()
  let pollingTimer = null
  const resolvedPollingConfig = { ...DEFAULT_POLLING_CONFIG, ...pollingConfig }
  const callExecuteCommand = (params) => Promise.resolve().then(() => executeCommand(params))
  const clockTimer = setInterval(() => {
    clockTick.value += 1
  }, 30000)

  const activeSession = computed(
    () => sessions.value.find((session) => session.id === activeSessionId.value) || null
  )
  const activeSessionLabel = computed(() => activeSession.value?.id?.slice(0, 8) || '--')
  const activeSessionTimeLabel = computed(() => {
    void clockTick.value
    return formatTerminalRelativeTime(activeSession.value?.lastActivityTime)
  })

  const isCurrentSession = (session) =>
    Boolean(
      session &&
      !session.disposed &&
      session.hostSessionId === hostSessionId.value &&
      sessions.value.includes(session)
    )

  const getViewport = (sessionId) => viewportRefs.get(sessionId)

  const applyTerminalMetadata = (response, session) => {
    if (!isCurrentSession(session)) return false
    const payload = response?.data
    if (!payload || typeof payload !== 'object') return true
    const responseInstanceId =
      typeof payload.instanceId === 'string' && payload.instanceId ? payload.instanceId : ''
    if (responseInstanceId) {
      if (!session.instanceId) {
        session.instanceId = responseInstanceId
      } else if (session.instanceId !== responseInstanceId) {
        session.routingMismatch = true
        session.nextReadTime = Date.now() + resolvedPollingConfig.idleInterval
        if (!session.routingWarningShown) {
          session.routingWarningShown = true
          getViewport(session.id)?.write(
            '\r\n\x1b[33m[终端请求已切换到另一服务实例，请为终端接口启用会话粘性路由]\x1b[0m\r\n'
          )
        }
        return false
      }
    }
    if (typeof payload.pty === 'boolean') session.pty = payload.pty
    if (typeof payload.resizable === 'boolean') session.resizable = payload.resizable
    if (typeof payload.backend === 'string' && payload.backend) session.backend = payload.backend
    if (typeof payload.longPolling === 'boolean') session.longPolling = payload.longPolling
    if (Array.isArray(payload.backendFailures)) session.backendFailures = payload.backendFailures
    else if (typeof payload.backendFailures === 'string' && payload.backendFailures) {
      session.backendFailures = [payload.backendFailures]
    }
    if (payload.missing === true) {
      session.ended = true
      session.endReason = '终端会话记录已失效'
    } else if (payload.alive === false) {
      session.ended = true
      session.endReason =
        payload.exitCode === null || payload.exitCode === undefined
          ? '终端进程已结束'
          : `终端进程已结束，退出码 ${payload.exitCode}`
    } else if (payload.alive === true) {
      session.ended = false
      session.endReason = ''
      session.endNoticeShown = false
    }
    return true
  }

  const setViewportRef = (instance, sessionId) => {
    if (instance) {
      viewportRefs.set(sessionId, instance)
      return
    }
    viewportRefs.delete(sessionId)
  }

  const stopPolling = () => {
    if (pollingTimer === null) return
    clearInterval(pollingTimer)
    pollingTimer = null
  }

  const readCommand = (session, silent = false) => {
    if (!isCurrentSession(session) || !session.viewportReady) return Promise.resolve()
    if (session.readPromise) return session.readPromise

    const request = callExecuteCommand({
      sessionId: session.hostSessionId,
      processId: session.id,
      cmd: session.longPolling ? String(resolvedPollingConfig.longPollWait) : '',
      type: 'read'
    })
      .then((response) => {
        if (!isCurrentSession(session)) return
        if (!applyTerminalMetadata(response, session)) return
        session.readErrorCount = 0
        session.nextReadTime = 0
        const output = decodeTerminalOutput(response)
        if (output) {
          getViewport(session.id)?.write(output)
          session.lastActivityTime = Date.now()
          if (session.id !== activeSessionId.value) session.hasUnread = true
        }
        if (session.ended && !session.endNoticeShown) {
          session.endNoticeShown = true
          getViewport(session.id)?.write(
            `\r\n\x1b[33m[${session.endReason}，请创建新终端继续操作]\x1b[0m\r\n`
          )
        }
      })
      .catch((error) => {
        if (!isCurrentSession(session)) return
        session.readErrorCount += 1
        const backoff = Math.min(
          resolvedPollingConfig.errorMaxInterval,
          resolvedPollingConfig.errorBaseInterval * 2 ** (session.readErrorCount - 1)
        )
        session.nextReadTime = Date.now() + backoff
        if (!silent) getViewport(session.id)?.write(`\x1b[31mError: ${error.message || error}\x1b[0m\n`)
      })
      .finally(() => {
        if (session.readPromise === request) session.readPromise = null
      })
    session.readPromise = request
    return request
  }

  const pollSessions = async () => {
    const now = Date.now()
    const readySessions = sessions.value.filter((session) => session.viewportReady && !session.ended)
    if (!readySessions.length) {
      stopPolling()
      return
    }
    const readableSessions = readySessions.filter((session) => {
      if (now < session.nextReadTime) return false
      const active =
        session.isLoading || now - session.lastActivityTime < resolvedPollingConfig.idleTimeout
      return active || now - session.lastPollTime >= resolvedPollingConfig.idleInterval
    })
    readableSessions.forEach((session) => {
      session.lastPollTime = now
    })
    await Promise.all(readableSessions.map((session) => readCommand(session, true)))
  }

  const startPolling = () => {
    if (pollingTimer !== null || !sessions.value.length) return
    pollingTimer = setInterval(pollSessions, resolvedPollingConfig.interval)
  }

  const markSessionActive = (session) => {
    if (!isCurrentSession(session)) return
    session.lastActivityTime = Date.now()
    if (session.id === activeSessionId.value) session.hasUnread = false
    startPolling()
  }

  const focusActiveViewport = () => {
    if (!activeSession.value) return
    const viewport = getViewport(activeSession.value.id)
    viewport?.fit()
    viewport?.focus()
  }

  const createSession = async () => {
    const capturedHostSessionId = hostSessionId.value
    if (!capturedHostSessionId) return null
    const session = createTerminalSession({
      id: createProcessId(),
      title: `终端 ${sessionSeed.value++}`,
      hostSessionId: capturedHostSessionId
    })
    sessions.value.push(session)
    activeSessionId.value = session.id
    startPolling()
    await nextTick()
    if (isCurrentSession(session)) focusActiveViewport()
    return session
  }

  const activateSession = (sessionId) => {
    const session = sessions.value.find((item) => item.id === sessionId)
    if (!isCurrentSession(session)) return
    activeSessionId.value = sessionId
    session.hasUnread = false
    markSessionActive(session)
  }

  const stopSessionProcess = (session) => {
    if (!session?.id || !session.hostSessionId) return
    callExecuteCommand({
      sessionId: session.hostSessionId,
      processId: session.id,
      cmd: '',
      type: 'stop'
    }).catch(() => {})
  }

  const disposeSession = (session) => {
    if (!session || session.disposed) return
    session.disposed = true
    session.viewportReady = false
    session.isLoading = false
    if (session.resizeTimer !== null) clearTimeout(session.resizeTimer)
    session.resizeTimer = null
    stopSessionProcess(session)
    viewportRefs.delete(session.id)
  }

  const removeSession = (sessionId) => {
    const index = sessions.value.findIndex((session) => session.id === sessionId)
    if (index === -1) return
    const session = sessions.value[index]
    disposeSession(session)
    sessions.value.splice(index, 1)

    if (!sessions.value.length) {
      activeSessionId.value = ''
      createSession()
      return
    }
    if (activeSessionId.value === sessionId) {
      activateSession((sessions.value[index] || sessions.value[index - 1]).id)
    }
  }

  const closeActiveSession = () => {
    if (activeSession.value) removeSession(activeSession.value.id)
  }

  const clearSessionViewport = (sessionId) => {
    const session = sessions.value.find((item) => item.id === sessionId)
    if (!isCurrentSession(session)) return
    getViewport(sessionId)?.clear()
    session.hasUnread = false
    markSessionActive(session)
  }

  const clearActiveViewport = () => {
    if (activeSession.value) clearSessionViewport(activeSession.value.id)
  }

  const queueSessionWrite = (session, chunk) => {
    if (!chunk || !isCurrentSession(session)) return Promise.resolve()
    if (session.ended) {
      if (!session.endNoticeShown) {
        session.endNoticeShown = true
        getViewport(session.id)?.write(
          `\r\n\x1b[33m[${session.endReason || '终端进程已结束'}，请创建新终端继续操作]\x1b[0m\r\n`
        )
      }
      return Promise.resolve()
    }
    session.pendingWrites += 1
    session.isLoading = true
    markSessionActive(session)

    const run = async () => {
      try {
        if (!isCurrentSession(session)) return
        if (session.initPromise) await session.initPromise.catch(() => {})
        if (!isCurrentSession(session) || !session.viewportReady || session.ended) return
        const response = await callExecuteCommand({
          sessionId: session.hostSessionId,
          processId: session.id,
          cmd: chunk,
          type: 'write'
        })
        if (applyTerminalMetadata(response, session) && isCurrentSession(session)) {
          await readCommand(session)
        }
      } catch (error) {
        if (isCurrentSession(session)) {
          getViewport(session.id)?.write(`\x1b[31mError: ${error.message || error}\x1b[0m\n`)
        }
      } finally {
        session.pendingWrites = Math.max(0, session.pendingWrites - 1)
        session.isLoading = isCurrentSession(session) && session.pendingWrites > 0
      }
    }
    session.writeChain = session.writeChain.catch(() => {}).then(run)
    return session.writeChain
  }

  const handleTerminalInput = (data, session) => queueSessionWrite(session, data)

  const handleTerminalResize = (size, session) => {
    if (!isCurrentSession(session)) return
    const cols = Math.max(20, Math.min(500, Number.parseInt(size?.cols, 10) || 80))
    const rows = Math.max(5, Math.min(200, Number.parseInt(size?.rows, 10) || 24))
    session.cols = cols
    session.rows = rows
    if (session.resizeTimer !== null) clearTimeout(session.resizeTimer)
    session.resizeTimer = setTimeout(() => {
      session.resizeTimer = null
      if (!isCurrentSession(session) || !session.viewportReady || session.resizable === false) return
      callExecuteCommand({
        sessionId: session.hostSessionId,
        processId: session.id,
        cmd: `${session.cols},${session.rows}`,
        type: 'resize'
      })
        .then((response) => applyTerminalMetadata(response, session))
        .catch(() => {})
    }, TERMINAL_RESIZE_DEBOUNCE)
  }

  const interruptSession = (sessionId) => {
    const session = sessions.value.find((item) => item.id === sessionId)
    return queueSessionWrite(session, '\x03')
  }

  const interruptActiveSession = () => {
    if (activeSession.value) interruptSession(activeSession.value.id)
  }

  const handleViewportReady = async (sessionId) => {
    const session = sessions.value.find((item) => item.id === sessionId)
    if (!isCurrentSession(session) || session.initializing || session.viewportReady) return
    session.initializing = true
    const initialization = callExecuteCommand({
      sessionId: session.hostSessionId,
      processId: session.id,
      cmd: 'init',
      type: 'write'
    })
    session.initPromise = initialization
    try {
      const response = await initialization
      if (!isCurrentSession(session)) return
      applyTerminalMetadata(response, session)
      session.viewportReady = true
      markSessionActive(session)
      handleTerminalResize({ cols: session.cols, rows: session.rows }, session)
    } catch (error) {
      if (isCurrentSession(session)) {
        session.ended = true
        session.endReason = `终端初始化失败: ${error.message || error}`
        onError(session.endReason)
      }
    } finally {
      if (session.initPromise === initialization) session.initPromise = null
      session.initializing = false
    }
  }

  const resetWorkspace = async () => {
    stopPolling()
    sessions.value.forEach(disposeSession)
    sessions.value = []
    viewportRefs.clear()
    activeSessionId.value = ''
    searchKeyword.value = ''
    sessionSeed.value = 1
    return createSession()
  }

  const handleSearchKeywordChange = (keyword) => {
    searchKeyword.value = keyword
    if (keyword) searchInActiveSession('next', { incremental: true })
  }

  const searchInActiveSession = (direction, options = {}) => {
    if (!activeSession.value || !searchKeyword.value.trim()) return
    const viewport = getViewport(activeSession.value.id)
    if (!viewport) return
    if (direction === 'prev') {
      viewport.searchPrevious(searchKeyword.value, options)
      return
    }
    viewport.searchNext(searchKeyword.value, options)
  }

  const disposeWorkspace = () => {
    stopPolling()
    sessions.value.forEach(disposeSession)
    sessions.value = []
    viewportRefs.clear()
    activeSessionId.value = ''
  }

  watch(activeSessionId, () => nextTick(focusActiveViewport))
  watch(
    hostSessionId,
    (nextHostSessionId, previousHostSessionId) => {
      if (nextHostSessionId === previousHostSessionId) return
      disposeWorkspace()
      sessionSeed.value = 1
      searchKeyword.value = ''
      if (nextHostSessionId) createSession()
    },
    { immediate: true }
  )
  onScopeDispose(disposeWorkspace)
  onScopeDispose(() => clearInterval(clockTimer))

  return {
    sessions,
    activeSessionId,
    activeSession,
    activeSessionLabel,
    activeSessionTimeLabel,
    searchKeyword,
    setViewportRef,
    createSession,
    activateSession,
    removeSession,
    closeActiveSession,
    clearSessionViewport,
    clearActiveViewport,
    interruptSession,
    interruptActiveSession,
    resetWorkspace,
    markSessionActive,
    handleViewportReady,
    handleTerminalInput,
    handleTerminalResize,
    handleSearchKeywordChange,
    searchInActiveSession
  }
}
