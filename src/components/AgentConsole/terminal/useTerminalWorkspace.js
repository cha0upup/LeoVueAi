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
  connectSsh,
  executeSsh,
  agentTerminalAvailable = ref(true),
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
    if (!agentTerminalAvailable.value || runtime.value !== 'java') return []
    const knownModes = sessions.value.find(
      (session) => session.connectionType === 'agent' && session.terminalModes.length
    )?.terminalModes
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
  const appendSession = async ({
    terminalMode = null,
    connectionType = 'agent',
    endpoint = '',
    profileId = '',
    title,
    execute
  }) => {
    if (!hostSessionId.value) return null
    const session = reactive(
      createTerminalSession({
        id: createProcessId(),
        title: title || `终端 ${sessionSeed++}`,
        hostSessionId: hostSessionId.value,
        terminalMode,
        connectionType,
        endpoint,
        profileId
      })
    )
    const controller = createTerminalSessionController({
      session,
      executeCommand: execute,
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
  const createSession = async (mode) => {
    if (!agentTerminalAvailable.value) return null
    const terminalMode = runtime.value === 'java' ? mode || 'pipe' : null
    if (terminalMode && !['pipe', 'python-pty'].includes(terminalMode)) return null
    return appendSession({ terminalMode, execute: executeCommand })
  }
  const createSshSession = async (options) => {
    if (!connectSsh || !executeSsh || !hostSessionId.value) throw new Error('SSH 终端尚未就绪')
    if (!options?.profileId) throw new Error('请选择已保存的 SSH 连接')
    const { profileId, version, host, port, username, name } = options
    const session = await appendSession({
      connectionType: 'ssh',
      profileId,
      endpoint: `${username}@${host}:${port}`,
      title: name || `${username}@${host}`,
      execute: async (params) => {
        if (params.type === 'init') {
          // Only identifiers enter connection requests; saved credentials stay on the backend.
          const response = await connectSsh({
            sessionId: params.sessionId,
            processId: params.processId,
            profileId,
            version
          })
          if (response?.data?.profileSaved === false)
            onError('SSH 已连接，但连接配置更新失败，请刷新列表')
        }
        return executeSsh(params)
      }
    })
    const controller = session && controllers.get(session.id)
    const ready = await controller?.initialize()
    if (!ready || !isCurrentSession(session)) {
      throw new Error(session?.endReason || 'SSH 连接已取消')
    }
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

  const clearActiveViewport = () => {
    const session = activeSession.value
    if (!isCurrentSession(session)) return
    getViewport(session.id)?.clear()
    session.hasUnread = false
    markSessionActive(session)
  }

  const handleTerminalInput = (data, session) => controllers.get(session?.id)?.write(data)
  const handleTerminalResize = (size, session) => controllers.get(session?.id)?.resize(size)
  const interruptActiveSession = () => controllers.get(activeSessionId.value)?.interrupt()
  const handleViewportReady = (sessionId) => controllers.get(sessionId)?.initialize()

  const resetWorkspace = () => {
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
    createSshSession,
    activateSession,
    removeSession,
    closeActiveSession,
    clearActiveViewport,
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
