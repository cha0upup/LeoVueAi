function parseHeadersToObject(headers) {
  if (!headers) return {}

  if (typeof headers === 'object' && !Array.isArray(headers)) {
    return Object.fromEntries(Object.entries(headers).filter(([key]) => String(key || '').trim()))
  }

  const raw = String(headers).trim()
  if (!raw) return {}

  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.fromEntries(Object.entries(parsed).filter(([key]) => String(key || '').trim()))
    }
  } catch { /* not JSON, fall through to line parsing */ }

  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce((acc, line) => {
      const separatorIndex = line.indexOf(':')
      if (separatorIndex === -1) return acc
      const key = line.slice(0, separatorIndex).trim()
      const value = line.slice(separatorIndex + 1).trim()
      if (key) acc[key] = value
      return acc
    }, {})
}

export function stringifyHeadersForSubmit(headers) {
  return JSON.stringify(parseHeadersToObject(headers))
}

export function formatHeadersForEditor(headers) {
  const entries = Object.entries(parseHeadersToObject(headers))
  if (!entries.length) return ''
  return entries.map(([key, value]) => `${key}: ${value ?? ''}`).join('\n')
}

export function getHeaderEntries(headers) {
  return Object.entries(parseHeadersToObject(headers))
}
