function parseHeadersToObject(headers) {
  if (!headers) return {}

  const raw = String(headers).trim()
  if (!raw) return {}

  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.fromEntries(Object.entries(parsed).filter(([key]) => String(key || '').trim()))
    }
  } catch { /* not JSON, fall through to line parsing */ }

  const headersObject = {}
  for (const line of raw.split(/\r?\n/)) {
    const separatorIndex = line.indexOf(':')
    if (separatorIndex === -1) continue
    const key = line.slice(0, separatorIndex).trim()
    if (key) headersObject[key] = line.slice(separatorIndex + 1).trim()
  }
  return headersObject
}

export function stringifyHeadersForSubmit(headers) {
  return JSON.stringify(parseHeadersToObject(headers))
}

export function formatHeadersForEditor(headers) {
  return getHeaderEntries(headers).map(([key, value]) => `${key}: ${value ?? ''}`).join('\n')
}

export function getHeaderEntries(headers) {
  return Object.entries(parseHeadersToObject(headers))
}
