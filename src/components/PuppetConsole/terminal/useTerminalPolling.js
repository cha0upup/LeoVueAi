import { onScopeDispose } from 'vue'
import { TERMINAL_POLLING } from './terminalProtocol.js'

/** Shared scheduling and browser lifecycle; each controller decides when to read. */
export function useTerminalPolling({ getControllers, interval = TERMINAL_POLLING.interval }) {
  let timer = null
  const stop = () => {
    clearInterval(timer)
    timer = null
  }
  const start = () => {
    if (timer !== null) return
    timer = setInterval(() => {
      let readable = false
      const now = Date.now()
      for (const controller of getControllers()) {
        if (!controller?.canRead()) continue
        readable = true
        controller.poll(now)
      }
      if (!readable) stop()
    }, interval)
  }

  if (typeof document !== 'undefined') {
    const onVisibilityChange = () => {
      if (document.hidden) return
      for (const controller of getControllers()) controller?.refresh()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    onScopeDispose(() => document.removeEventListener('visibilitychange', onVisibilityChange))
  }
  onScopeDispose(stop)
  return { start, stop }
}
