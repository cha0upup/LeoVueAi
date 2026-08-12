import { computed, nextTick, onScopeDispose, ref, watch } from 'vue'
import { v4 as uuidV4 } from 'uuid'
import { getDockerResourceId, quoteShellArg } from './dockerManagerModel.js'

const DEFAULT_POLLING_INTERVAL = 500
const DEFAULT_IDLE_TIMEOUT = 15000

function decodeBase64(value) {
  if (typeof value !== 'string' || !value) return ''
  try {
    return new TextDecoder('utf-8').decode(
      Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
    )
  } catch {
    return ''
  }
}

function getCommandOutput(response) {
  const payload = response?.data
  const encoded = payload && typeof payload === 'object' ? payload.data : payload
  return decodeBase64(encoded)
}

export function useDockerTerminal({
  sessionId,
  executeCommand,
  createProcessId = uuidV4,
  pollingInterval = DEFAULT_POLLING_INTERVAL,
  idleTimeout = DEFAULT_IDLE_TIMEOUT,
  delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
}) {
  const active = ref(false)
  const ready = ref(false)
  const containerId = ref('')
  const containerName = ref('')
  const processId = ref('')
  const viewportRef = ref(null)

  let currentContext = null
  let pollingTimer = null

  const isCurrent = (context) => currentContext === context && active.value

  const writeViewport = (context, output) => {
    if (isCurrent(context) && output) viewportRef.value?.write(output)
  }

  const readOutput = async (context, { silent = true } = {}) => {
    if (!isCurrent(context) || context.pollInFlight) return
    context.pollInFlight = true
    try {
      const response = await executeCommand({
        sessionId: context.sessionId,
        processId: context.processId,
        cmd: 'read',
        type: 'read'
      })
      if (!isCurrent(context)) return
      const output = getCommandOutput(response)
      if (output) {
        writeViewport(context, output)
        context.lastActivity = Date.now()
      }
    } catch (error) {
      if (!silent) writeViewport(context, `\x1b[31mError: ${error.message || error}\x1b[0m\r\n`)
    } finally {
      context.pollInFlight = false
    }
  }

  const stopPolling = () => {
    if (pollingTimer === null) return
    clearInterval(pollingTimer)
    pollingTimer = null
  }

  const startPolling = (context) => {
    if (!isCurrent(context) || pollingTimer !== null) return
    pollingTimer = setInterval(() => {
      if (!isCurrent(context) || Date.now() - context.lastActivity > idleTimeout) {
        stopPolling()
        return
      }
      readOutput(context)
    }, pollingInterval)
  }

  const stopContextProcess = (context) => {
    if (!context?.sessionId || !context.processId) return
    executeCommand({
      sessionId: context.sessionId,
      processId: context.processId,
      cmd: '',
      type: 'stop'
    }).catch(() => {})
  }

  const close = () => {
    const context = currentContext
    currentContext = null
    stopPolling()
    active.value = false
    ready.value = false
    containerId.value = ''
    containerName.value = ''
    processId.value = ''
    if (context) stopContextProcess(context)
  }

  const open = async (row) => {
    const id = getDockerResourceId(row)
    if (!id || !sessionId.value) return
    if (currentContext) {
      close()
      await nextTick()
    }

    const context = {
      token: Symbol('docker-terminal'),
      sessionId: sessionId.value,
      processId: createProcessId(),
      containerId: id,
      containerName: row?.name || id,
      lastActivity: Date.now(),
      pollInFlight: false,
      writeChain: Promise.resolve()
    }
    currentContext = context
    containerId.value = context.containerId
    containerName.value = context.containerName
    processId.value = context.processId
    ready.value = false
    active.value = true
  }

  const handleReady = async () => {
    const context = currentContext
    if (!isCurrent(context)) return
    try {
      await executeCommand({
        sessionId: context.sessionId,
        processId: context.processId,
        cmd: 'init',
        type: 'write'
      })
      if (!isCurrent(context)) return
      await delay(300)
      if (!isCurrent(context)) return
      await readOutput(context)
      if (!isCurrent(context)) return

      await executeCommand({
        sessionId: context.sessionId,
        processId: context.processId,
        cmd: `docker exec -it ${quoteShellArg(context.containerId)} /bin/sh\n`,
        type: 'write'
      })
      if (!isCurrent(context)) return
      await delay(500)
      if (!isCurrent(context)) return
      await readOutput(context)
      if (!isCurrent(context)) return

      ready.value = true
      context.lastActivity = Date.now()
      startPolling(context)
    } catch (error) {
      writeViewport(context, `\x1b[31mFailed to attach: ${error.message || error}\x1b[0m\r\n`)
    }
  }

  const write = (data) => {
    const context = currentContext
    if (!isCurrent(context) || !data) return Promise.resolve()
    context.lastActivity = Date.now()
    startPolling(context)
    context.writeChain = context.writeChain
      .catch(() => {})
      .then(async () => {
        if (!isCurrent(context)) return
        try {
          await executeCommand({
            sessionId: context.sessionId,
            processId: context.processId,
            cmd: data,
            type: 'write'
          })
          if (isCurrent(context)) await readOutput(context, { silent: false })
        } catch (error) {
          writeViewport(context, `\x1b[31mError: ${error.message || error}\x1b[0m\r\n`)
        }
      })
    return context.writeChain
  }

  watch(sessionId, (nextSessionId) => {
    if (currentContext && currentContext.sessionId !== nextSessionId) close()
  })
  onScopeDispose(close)

  return {
    terminalActive: computed(() => active.value),
    terminalReady: computed(() => ready.value),
    terminalContainerId: computed(() => containerId.value),
    terminalContainerName: computed(() => containerName.value),
    terminalProcessId: computed(() => processId.value),
    containerViewportRef: viewportRef,
    openContainerTerminal: open,
    closeContainerTerminal: close,
    handleContainerTerminalReady: handleReady,
    handleContainerTerminalInput: write
  }
}
