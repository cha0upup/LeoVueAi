import { computed, nextTick, onScopeDispose, reactive, ref, watch } from 'vue'
import { v4 as uuidV4 } from 'uuid'
import { createTerminalSession, formatTerminalRelativeTime } from './terminalWorkspaceModel.js'
import { createTerminalSessionController } from './createTerminalSessionController.js'
import { useTerminalPolling } from './useTerminalPolling.js'

/** Workspace presentation: tabs, viewports, search and the shared polling clock. */
export function useTerminalWorkspace({
  hostSessionId,
  runtime = ref('java'),
  executeCommand,
  createProcessId = uuidV4,
  pollingConfig = {},
  onError = () => {}
}) {
  const sessions = ref([])
  const activeSessionId = ref('')
  const searchKeyword = ref('')
  const clockNow = ref(Date.now())
  const viewportRefs = new Map()
  const controllers = new Map()
  let sessionSeed = 1
  const { start: startPolling, stop: stopPolling } = useTerminalPolling({
    getControllers: () => controllers.values(),
    interval: pollingConfig.interval
  })
  const clockTimer = setInterval(() => {
    clockNow.value = Date.now()
  }, 30000)

  const activeSession = computed(
    () => sessions.value.find((session) => session.id === activeSessionId.value) || null
  )
  const terminalModeOptions = computed(() => {
    if (runtime.value !== 'java') return []
    const knownModes = sessions.value.find((session) => session.terminalModes.length)?.terminalModes
    return [
      { value: 'pipe', label: 'Java 原生管道', disabled: false },
      { value: 'python-pty', label: 'Python PTY', disabled: !knownModes?.includes('python-pty') }
    ]
  })
  const activeSessionTimeLabel = computed(() =>
    formatTerminalRelativeTime(activeSession.value?.lastActivityTime, clockNow.value)
  )
  const isCurrentSession = (session) =>
    Boolean(session && session.hostSessionId === hostSessionId.value && controllers.has(session.id))
  const getViewport = (sessionId) => viewportRefs.get(sessionId)
  const setViewportRef = (instance, sessionId) => {
    if (instance) viewportRefs.set(sessionId, instance)
    else viewportRefs.delete(sessionId)
  }
  const markSessionActive = (session) => {
    if (!isCurrentSession(session)) return
    controllers.get(session.id).activity()
  }
  const focusActiveViewport = () => {
    const viewport = getViewport(activeSessionId.value)
    viewport?.fit()
    viewport?.focus()
  }
  const createSession = async (mode) => {
    if (!hostSessionId.value) return null
    const terminalMode = runtime.value === 'java' ? mode || 'pipe' : null
    if (terminalMode && !['pipe', 'python-pty'].includes(terminalMode)) return null
    const session = reactive(
      createTerminalSession({
        id: createProcessId(),
        title: `终端 ${sessionSeed++}`,
        hostSessionId: hostSessionId.value,
        terminalMode
      })
    )
    const controller = createTerminalSessionController({
      session,
      executeCommand,
      pollingConfig,
      onError,
      isCurrent: () => isCurrentSession(session),
      isForeground: () =>
        session.id === activeSessionId.value &&
        getViewport(session.id)?.isVisible?.() !== false &&
        (typeof document === 'undefined' || !document.hidden),
      onActivity: startPolling,
      onOutput: (output, remote) => {
        getViewport(session.id)?.write(output)
        if (remote && session.id !== activeSessionId.value) session.hasUnread = true
      }
    })
    controllers.set(session.id, controller)
    sessions.value.push(session)
    activeSessionId.value = session.id
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
  const disposeSession = (session) => {
    const controller = controllers.get(session.id)
    controllers.delete(session.id)
    viewportRefs.delete(session.id)
    return controller?.dispose()
  }
  const removeSession = (sessionId) => {
    const index = sessions.value.findIndex((session) => session.id === sessionId)
    if (index === -1) return
    const session = sessions.value[index]
    disposeSession(session)
    sessions.value.splice(index, 1)

    if (!sessions.value.length) {
      activeSessionId.value = ''
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

  const handleTerminalInput = (data, session) => controllers.get(session?.id)?.write(data)
  const handleTerminalResize = (size, session) => controllers.get(session?.id)?.resize(size)
  const interruptSession = (sessionId) => controllers.get(sessionId)?.interrupt()
  const interruptActiveSession = () => interruptSession(activeSessionId.value)
  const handleViewportReady = (sessionId) => controllers.get(sessionId)?.initialize()

  const resetWorkspace = async () => {
    disposeWorkspace()
    searchKeyword.value = ''
    sessionSeed = 1
    return createSession()
  }

  const handleSearchKeywordChange = (keyword) => {
    searchKeyword.value = keyword
    if (keyword.trim()) searchInActiveSession('next', { incremental: true })
    else getViewport(activeSessionId.value)?.clearSearch?.()
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

  const refreshActiveSession = () => controllers.get(activeSessionId.value)?.refresh()
  watch(activeSessionId, (_, previousId) => {
    searchKeyword.value = ''
    getViewport(previousId)?.clearSearch?.()
    nextTick(() => {
      focusActiveViewport()
      refreshActiveSession()
    })
  })
  watch(
    hostSessionId,
    (nextHostSessionId, previousHostSessionId) => {
      if (nextHostSessionId === previousHostSessionId) return
      disposeWorkspace()
      sessionSeed = 1
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
    activeSessionTimeLabel,
    terminalModeOptions,
    clockNow,
    searchKeyword,
    setViewportRef,
    focusActiveViewport,
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
