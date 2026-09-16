export const TERMINAL_POLLING = Object.freeze({
  interval: 250,
  idleIntervals: Object.freeze([3000, 5000, 10000, 20000]),
  longPollWait: 10000,
  backgroundInterval: 5000,
  errorBaseInterval: 1000,
  errorMaxInterval: 10000
})

export const TERMINAL_RESIZE_DELAY = 120
export const TERMINAL_INTERRUPT = '\x03'
export const TERMINAL_INPUT_DELAY = 100
export const TERMINAL_INPUT_LIMIT = 1024 * 1024

export function isCommandTerminal(session) {
  return session?.backend === 'unix-command' || session?.backend === 'windows-command'
}

export function normalizeTerminalSize(size) {
  return {
    cols: Math.max(20, Math.min(500, Number.parseInt(size?.cols, 10) || 80)),
    rows: Math.max(5, Math.min(200, Number.parseInt(size?.rows, 10) || 24))
  }
}

export function createTerminalOutputDecoder() {
  const decoder = new TextDecoder('utf-8')
  return (payload, eof = false) => {
    let output = ''
    if (typeof payload.data === 'string' && payload.data) {
      let bytes
      try {
        bytes = Uint8Array.from(atob(payload.data), (character) => character.charCodeAt(0))
      } catch {
        throw new Error('终端输出不是有效的 Base64 数据')
      }
      output = decoder.decode(bytes, { stream: true })
    }
    return output + (eof ? decoder.decode() : '')
  }
}

export function terminalNotice(message, error = false) {
  return `\r\n\x1b[${error ? 31 : 33}m[${message}]\x1b[0m\r\n`
}
