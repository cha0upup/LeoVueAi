import { TERMINAL_INPUT_DELAY, TERMINAL_INPUT_LIMIT } from './terminalProtocol.js'

/** A short batching window plus one in-flight write. No retries of terminal input. */
export function createTerminalInputQueue({
  send,
  canWrite,
  onError,
  delay = TERMINAL_INPUT_DELAY
}) {
  const encoder = new TextEncoder()
  let queued = []
  let queuedBytes = 0
  let sending = false
  let timer = null

  const clearTimer = () => {
    clearTimeout(timer)
    timer = null
  }
  const settle = (batch, accepted) => batch.waiters.forEach((resolve) => resolve(accepted))
  const cancel = () => {
    clearTimer()
    queued.forEach((batch) => settle(batch, false))
    queued = []
    queuedBytes = 0
  }

  const flush = async () => {
    if (sending) return
    clearTimer()
    if (!canWrite()) return cancel()
    if (!queued.length) return
    const batch = queued.shift()
    queuedBytes -= batch.bytes
    sending = true
    let accepted = false
    try {
      accepted = await send(batch.type, batch.data)
    } catch (error) {
      onError(error)
    } finally {
      sending = false
      settle(batch, accepted)
      // A failed/partial write must not be followed by stale queued commands.
      if (!accepted) cancel()
      else if (queued.length) flush()
    }
  }

  const write = (type, data, immediate = false) => {
    if (!canWrite()) return Promise.resolve(false)
    const bytes = encoder.encode(data).length
    if (queuedBytes + bytes > TERMINAL_INPUT_LIMIT) {
      cancel()
      onError(new Error('待发送终端输入超过 1 MiB，已取消尚未发送的输入'))
      return Promise.resolve(false)
    }
    let batch = queued.at(-1)
    if (!batch || batch.type !== type) {
      batch = { type, data: '', bytes: 0, waiters: [] }
      queued.push(batch)
    }
    batch.data += data
    batch.bytes += bytes
    queuedBytes += bytes
    const pending = new Promise((resolve) => batch.waiters.push(resolve))
    if (immediate) {
      clearTimer()
      flush()
    } else if (!sending && timer === null) {
      // Do not reset the deadline on each key: continuous input must keep flowing.
      timer = setTimeout(flush, delay)
    }
    return pending
  }

  return { write, cancel }
}
