const toPort = value => {
  const port = Number(value)
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : null
}

export const parseHostHeader = rawHttp => {
  const match = String(rawHttp || '').match(/^Host:\s*([^\s]+)\s*$/im)
  if (!match) return { host: '', port: null }
  const value = match[1]

  if (value.startsWith('[')) {
    const closingBracket = value.indexOf(']')
    if (closingBracket < 0) return { host: value, port: null }
    const host = value.slice(0, closingBracket + 1)
    const port = value[closingBracket + 1] === ':'
      ? toPort(value.slice(closingBracket + 2))
      : null
    return { host, port }
  }

  const colonIndex = value.lastIndexOf(':')
  if (colonIndex > 0 && value.indexOf(':') === colonIndex) {
    const port = toPort(value.slice(colonIndex + 1))
    if (port) return { host: value.slice(0, colonIndex), port }
  }
  return { host: value, port: null }
}

export const resolveHttpTarget = (rawHttp, config = {}) => {
  const parsed = parseHostHeader(rawHttp)
  return {
    host: String(config.targetHost || '').trim() || parsed.host,
    port: toPort(config.targetPort) || parsed.port || (config.useTls ? 443 : 80)
  }
}

export const getContentLengthUpdate = rawHttp => {
  const text = String(rawHttp || '').replace(/\r\n/g, '\n')
  const separatorIndex = text.indexOf('\n\n')
  if (separatorIndex < 0) return null
  const lines = text.split('\n')
  const headerLineCount = text.slice(0, separatorIndex).split('\n').length
  const lineIndex = lines.slice(0, headerLineCount).findIndex(line => /^Content-Length\s*:/i.test(line))
  if (lineIndex < 0) return null
  const body = text.slice(separatorIndex + 2)
  const byteLength = new TextEncoder().encode(body).length
  const currentLine = lines[lineIndex]
  const newLine = `${currentLine.slice(0, currentLine.indexOf(':') + 1)} ${byteLength}`
  return newLine === currentLine ? null : { lineNumber: lineIndex + 1, text: newLine }
}

export const normalizeRepeaterResponse = (data, elapsed) => {
  const response = data || {}
  let body = response.body ?? ''
  if (typeof body !== 'string') {
    try {
      body = JSON.stringify(body, null, 2)
    } catch {
      body = String(body)
    }
  }
  return {
    statusCode: Number(response.statusCode) || null,
    statusMessage: String(response.statusMessage || ''),
    responseHeaders:
      response.responseHeaders && typeof response.responseHeaders === 'object'
        ? response.responseHeaders
        : {},
    body,
    bodyType: response.bodyType,
    elapsed: Math.max(0, Number(elapsed) || 0),
    bodyLength: new TextEncoder().encode(body).length
  }
}

export const buildRawHttpResponse = response => {
  if (!response) return ''
  const lines = [`HTTP/1.1 ${response.statusCode || ''} ${response.statusMessage || ''}`.trim()]
  Object.entries(response.responseHeaders || {}).forEach(([key, value]) => {
    const values = Array.isArray(value) ? value : [value]
    values.forEach(item => lines.push(`${key}: ${item ?? ''}`))
  })
  lines.push('', String(response.body ?? ''))
  return lines.join('\n')
}

export const buildPayloadsMap = payloadVariables => {
  const payloads = {}
  ;(Array.isArray(payloadVariables) ? payloadVariables : []).forEach(item => {
    const name = String(item?.name || '').trim()
    if (!name) return
    const values = String(item?.values || '')
      .split(/\r?\n/)
      .map(value => value.trim())
      .filter(Boolean)
    if (values.length) payloads[name] = values
  })
  return payloads
}

export const buildFuzzMatchRules = config => {
  const codes = String(config?.matchStatusCode || '')
    .split(',')
    .map(value => Number.parseInt(value.trim(), 10))
    .filter(code => Number.isInteger(code) && code >= 100 && code <= 599)
  const uniqueCodes = [...new Set(codes)]
  const rules = {}
  if (uniqueCodes.length === 1) rules.statusCode = uniqueCodes[0]
  if (uniqueCodes.length > 1) rules.statusCode = uniqueCodes
  const bodyContains = String(config?.matchBodyContains || '').trim()
  if (bodyContains) rules.bodyContains = bodyContains
  return Object.keys(rules).length ? rules : undefined
}

export const normalizeFuzzSnapshot = (data, taskId) => {
  const snapshot = data || {}
  const results = Array.isArray(snapshot.results)
    ? [...snapshot.results].sort((a, b) => Number(a?.index || 0) - Number(b?.index || 0))
    : []
  return {
    task: {
      taskId,
      total: Math.max(0, Number(snapshot.total) || 0),
      completed: Math.max(0, Number(snapshot.completed) || 0),
      status: String(snapshot.status || 'RUNNING').toUpperCase()
    },
    results
  }
}

export const isTerminalFuzzStatus = status => ['FINISHED', 'STOPPED', 'FAILED'].includes(status)

export const getHttpStatusTagType = code => {
  const value = Number(code)
  if (value >= 200 && value < 300) return 'success'
  if (value >= 300 && value < 400) return 'warning'
  if (value >= 400) return 'danger'
  return 'info'
}

export const getFuzzStatusTagType = status =>
  ({ RUNNING: 'primary', FINISHED: 'success', STOPPED: 'warning', FAILED: 'danger' })[
    String(status || '').toUpperCase()
  ] || 'info'

export const formatPayloads = payloads => {
  if (!payloads || typeof payloads !== 'object') return '-'
  return Object.entries(payloads).map(([key, value]) => `${key}=${value}`).join(', ') || '-'
}
