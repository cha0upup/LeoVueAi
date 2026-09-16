import { computed, onScopeDispose, reactive, ref, shallowRef, watch } from 'vue'
import { v4 as uuidV4 } from 'uuid'
import { getDockerResourceId, quoteShellArg } from './dockerManagerModel.js'
import { createTerminalSession } from '../terminal/terminalWorkspaceModel.js'
import { createTerminalSessionController } from '../terminal/createTerminalSessionController.js'
import { useTerminalPolling } from '../terminal/useTerminalPolling.js'
import { isCommandTerminal, terminalNotice } from '../terminal/terminalProtocol.js'

/** Container attachment only; terminal transport/lifecycle is shared with the workspace. */
export function useDockerTerminal({
  sessionId,
  executeCommand,
  createProcessId = uuidV4,
  pollingInterval = 500,
  onError = () => {}
}) {
  const context = shallowRef(null)
  const viewportRef = ref(null)
  const { start: startPolling, stop: stopPolling } = useTerminalPolling({
    getControllers: () => (context.value ? [context.value.controller] : []),
    interval: pollingInterval
  })
  const close = () => {
    const previous = context.value
    context.value = null
    stopPolling()
    return previous?.controller.dispose()
  }
  const open = (row) => {
    const id = getDockerResourceId(row)
    if (!id || !sessionId.value) return
    close()
    const session = reactive(
      createTerminalSession({
        id: createProcessId(),
        title: row?.name || id,
        hostSessionId: sessionId.value
      })
    )
    const next = { session, containerId: id, ready: ref(false), attaching: null, controller: null }
    next.controller = createTerminalSessionController({
      session,
      executeCommand,
      onError,
      isCurrent: () => context.value === next,
      isForeground: () =>
        viewportRef.value?.isVisible?.() !== false &&
        (typeof document === 'undefined' || !document.hidden),
      onOutput: (output) => viewportRef.value?.write(output),
      onActivity: startPolling
    })
    context.value = next
  }
  const handleReady = () => {
    const current = context.value
    if (!current) return Promise.resolve()
    if (current.attaching) return current.attaching
    current.attaching = (async () => {
      if (!(await current.controller.initialize()) || context.value !== current) return
      if (isCommandTerminal(current.session)) {
        current.session.endReason = '容器交互终端需要持续运行的 shell，请使用支持 PTY 或管道的节点'
        current.session.processExited = true
        current.session.ended = true
        viewportRef.value?.write(terminalNotice(current.session.endReason, true))
        await current.controller.dispose()
        return
      }
      const flags = current.session.pty === false ? '-i' : '-it'
      const attached = await current.controller.write(
        `docker exec ${flags} ${quoteShellArg(current.containerId)} /bin/sh\n`
      )
      if (context.value !== current) return
      current.ready.value = attached
      if (!attached) {
        current.session.endReason ||= '容器终端连接失败'
        current.session.processExited = true
        current.session.ended = true
        await current.controller.dispose()
      }
    })()
    return current.attaching
  }
  watch(sessionId, (nextId) => {
    if (context.value && context.value.session.hostSessionId !== nextId) close()
  })
  onScopeDispose(close)

  return {
    terminalActive: computed(() => context.value !== null),
    terminalReady: computed(() =>
      Boolean(context.value?.ready.value && !context.value.session.processExited)
    ),
    terminalContainerId: computed(() => context.value?.containerId || ''),
    terminalContainerName: computed(() => context.value?.session.title || ''),
    terminalProcessId: computed(() => context.value?.session.id || ''),
    terminalSession: computed(() => context.value?.session || null),
    containerViewportRef: viewportRef,
    openContainerTerminal: open,
    closeContainerTerminal: close,
    handleContainerTerminalReady: handleReady,
    handleContainerTerminalInput: (data) => context.value?.controller.write(data),
    handleContainerTerminalResize: (size) => context.value?.controller.resize(size)
  }
}
