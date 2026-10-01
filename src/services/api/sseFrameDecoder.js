// Decode line boundaries independently of UTF-8 chunks and AI event semantics.
// A trailing CR consumes a possible LF from the next chunk exactly once.
export function createSseFrameDecoder(onFrame) {
  let buffer = ''
  let skipLF = false
  let event = ''
  let id = ''
  let data = []

  const dispatch = () => {
    if (event || data.length) onFrame(event, data.join('\n'), id)
    event = ''
    id = ''
    data = []
  }

  const readLine = line => {
    if (line === '') {
      dispatch()
      return
    }
    const separator = line.indexOf(':')
    const field = separator < 0 ? line : line.slice(0, separator)
    let value = separator < 0 ? '' : line.slice(separator + 1)
    if (value.startsWith(' ')) value = value.slice(1)
    if (field === 'event') event = value
    else if (field === 'id' && !value.includes('\0')) id = value
    else if (field === 'data') data.push(value)
  }

  const push = text => {
    let start = 0
    if (skipLF && text.length) {
      if (text[0] === '\n') start = 1
      skipLF = false
    }
    for (let index = start; index < text.length; index += 1) {
      const char = text[index]
      if (char !== '\r' && char !== '\n') continue
      readLine(buffer + text.slice(start, index))
      buffer = ''
      if (char === '\r') {
        if (text[index + 1] === '\n') index += 1
        else if (index === text.length - 1) skipLF = true
      }
      start = index + 1
    }
    buffer += text.slice(start)
  }

  return {
    push,
    finish() {
      if (buffer) readLine(buffer)
      buffer = ''
      // Retain compatibility with streams ending without the final blank line.
      dispatch()
    }
  }
}
