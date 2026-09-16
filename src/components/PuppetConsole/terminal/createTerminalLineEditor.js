import { TERMINAL_INPUT_LIMIT, terminalNotice } from './terminalProtocol.js'

const TAB_SPACES = '    '
const WIDE_CHARACTER =
  /[\p{Extended_Pictographic}\u1100-\u115f\u2329\u232a\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe10-\ufe19\ufe30-\ufe6f\uff01-\uff60\uffe0-\uffe6]/u
const COMBINING_MARKS = /^\p{Mark}+$/u

/** Basic PIPE editing; PTY editing remains entirely in the remote terminal. */
export function createTerminalLineEditor() {
  const encoder = new TextEncoder()
  const segmenter =
    typeof Intl.Segmenter === 'function'
      ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
      : { segment: (text) => Array.from(text, (segment) => ({ segment })) }
  let line = ''
  let byteLength = 0
  let escape = 0
  let skipLf = false

  const clearLine = () => {
    line = ''
    byteLength = 0
  }
  const reset = () => {
    clearLine()
    escape = 0
    skipLf = false
  }
  const erase = (text) => {
    // xterm uses two cells for CJK and emoji, zero for combining marks.
    let columns = 0
    for (const { segment } of segmenter.segment(text)) {
      if (segment === '\t') columns += TAB_SPACES.length
      else if (WIDE_CHARACTER.test(segment)) columns += 2
      else if (!COMBINING_MARKS.test(segment)) columns += 1
    }
    return '\b \b'.repeat(columns)
  }
  const removeLastCharacter = () => {
    let last = ''
    for (const { segment } of segmenter.segment(line)) last = segment
    line = line.slice(0, line.length - last.length)
    byteLength -= encoder.encode(last).length
    return erase(last)
  }

  const write = (input) => {
    let output = ''
    let complete = ''
    let completeBytes = 0
    const overflow = () => {
      reset()
      return { data: '', output, error: '输入超过 1 MiB，已取消待发送输入并清空当前行' }
    }
    for (const character of input) {
      const value = character.codePointAt(0)
      if (escape) {
        if (escape === 1 && (character === '[' || character === 'O')) escape = 2
        else if (value >= 64 && value <= 126) escape = 0
        continue
      }
      if (value === 27) {
        escape = 1
        continue
      }
      if (character === '\n' && skipLf) {
        skipLf = false
        continue
      }
      skipLf = character === '\r'
      if (character === '\r' || character === '\n') {
        completeBytes += byteLength + 1
        if (completeBytes > TERMINAL_INPUT_LIMIT) return overflow()
        complete += `${line}\n`
        clearLine()
        output += '\r\n'
      } else if (value === 8 || value === 127) {
        output += removeLastCharacter()
      } else if (value === 3 || value === 21) {
        output +=
          value === 3
            ? `^C${terminalNotice('PIPE：已清空输入；中断运行中的进程请使用 PTY 或关闭终端')}`
            : erase(line)
        clearLine()
      } else if (value >= 32 || character === '\t') {
        const size = value < 128 ? 1 : encoder.encode(character).length
        if (completeBytes + byteLength + size >= TERMINAL_INPUT_LIMIT) {
          // Never submit a truncated pasted command.
          return overflow()
        }
        line += character
        byteLength += size
        output += character === '\t' ? TAB_SPACES : character
      }
    }
    return { data: complete, output, error: '' }
  }

  return { write, reset }
}
