const DEFAULT_DISGUISE_VERSION = '1.0.0'
export const DEFAULT_DISGUISE_HEADERS = '{\n  "Content-Type": "application/octet-stream"\n}'
const DEFAULT_TRAFFIC_ENCODE = `public byte[] encodeTraffic(byte[] data) throws Exception {\n    if (data == null) throw new IllegalArgumentException("payload不能为空");\n    return java.util.Base64.getEncoder().encode(data);\n}`
const DEFAULT_TRAFFIC_DECODE = `public byte[] decodeTraffic(byte[] data) throws Exception {\n    if (data == null) throw new IllegalArgumentException("body不能为空");\n    return java.util.Base64.getDecoder().decode(data);\n}`
export const DEFAULT_PHP_TRAFFIC_ENCODE = `if (!is_string($payload)) { throw new InvalidArgumentException('Payload must be binary'); }\nreturn rtrim(strtr(base64_encode($payload), '+/', '-_'), '=');`
export const DEFAULT_PHP_TRAFFIC_DECODE = `if (!is_string($body)) { throw new InvalidArgumentException('Body must be binary'); }\n$token = strtr($body, '-_', '+/');\n$remainder = strlen($token) % 4;\nif ($remainder !== 0) { $token .= str_repeat('=', 4 - $remainder); }\n$decoded = base64_decode($token, true);\nif ($decoded === false) { throw new InvalidArgumentException('Invalid base64 body'); }\nreturn $decoded;`

export function normalizeDisguiseRuntimes(runtimes) {
  const normalized = new Set(['java'])
  if (Array.isArray(runtimes)) {
    runtimes.forEach(runtime => {
      const value = String(runtime || '').trim().toLowerCase()
      if (value === 'php') normalized.add(value)
    })
  }
  return [...normalized]
}

export function stringifyDisguiseHeaders(headers) {
  if (!headers) return DEFAULT_DISGUISE_HEADERS
  if (typeof headers === 'string') {
    try {
      return JSON.stringify(JSON.parse(headers), null, 2)
    } catch {
      return headers
    }
  }
  if (typeof headers === 'object' && !Array.isArray(headers)) {
    return JSON.stringify(headers, null, 2)
  }
  return DEFAULT_DISGUISE_HEADERS
}

export function resolveDisguiseHeadersStatus(text) {
  if (!text?.trim()) return { state: 'empty', message: '未填写' }
  try {
    const parsed = JSON.parse(text)
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      return { state: 'invalid', message: '必须是 JSON 对象' }
    }
    return { state: 'valid', message: `合法 JSON · ${Object.keys(parsed).length} 个字段` }
  } catch (error) {
    return {
      state: 'invalid',
      message: error?.message?.replace(/^JSON\.parse:?\s*/i, '') || '解析失败'
    }
  }
}

export function createDisguiseEditorForm(disguise = null) {
  const runtimes = normalizeDisguiseRuntimes(disguise?.supportedRuntimes)
  const phpEnabled = runtimes.includes('php')
  return {
    disguiseId: disguise?.disguiseId || '',
    disguiseName: disguise?.disguiseName || '',
    version: disguise?.version || DEFAULT_DISGUISE_VERSION,
    headersText: stringifyDisguiseHeaders(disguise?.headers),
    description: disguise?.description || '',
    remark: disguise?.remark || '',
    trafficEncodeBody: disguise?.trafficEncodeBody || DEFAULT_TRAFFIC_ENCODE,
    trafficDecodeBody: disguise?.trafficDecodeBody || DEFAULT_TRAFFIC_DECODE,
    schemaVersion: disguise?.schemaVersion || 3,
    protocolVersion: disguise?.protocolVersion || 3,
    supportedRuntimes: runtimes,
    phpTrafficEncodeBody: disguise?.phpTrafficEncodeBody || (phpEnabled ? DEFAULT_PHP_TRAFFIC_ENCODE : ''),
    phpTrafficDecodeBody: disguise?.phpTrafficDecodeBody || (phpEnabled ? DEFAULT_PHP_TRAFFIC_DECODE : '')
  }
}

export function applyDisguiseTemplate(form, template) {
  if (!template) return form
  const next = createDisguiseEditorForm(template)
  next.disguiseId = form.disguiseId
  Object.assign(form, next)
  return form
}

export function createDisguiseIdPreview({ disguiseId, disguiseName, version }) {
  if (disguiseId?.trim()) return disguiseId.trim()
  const safeName = (disguiseName || 'disguise')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'disguise'
  return `${safeName}_${version?.trim() || DEFAULT_DISGUISE_VERSION}`
}

export function buildDisguisePayload(form) {
  const headers = JSON.parse(form.headersText)
  const supportedRuntimes = normalizeDisguiseRuntimes(form.supportedRuntimes)
  const phpEnabled = supportedRuntimes.includes('php')
  return {
    disguiseId: form.disguiseId?.trim() || undefined,
    disguiseName: form.disguiseName.trim(),
    version: form.version?.trim() || DEFAULT_DISGUISE_VERSION,
    headers: JSON.stringify(headers),
    description: form.description?.trim() || '',
    remark: form.remark?.trim() || '',
    trafficEncodeBody: form.trafficEncodeBody?.trim(),
    trafficDecodeBody: form.trafficDecodeBody?.trim(),
    schemaVersion: form.schemaVersion,
    protocolVersion: form.protocolVersion,
    supportedRuntimes,
    phpTrafficEncodeBody: phpEnabled ? form.phpTrafficEncodeBody?.trim() : null,
    phpTrafficDecodeBody: phpEnabled ? form.phpTrafficDecodeBody?.trim() : null,
    requirements: phpEnabled ? { php: { minVersion: '5.6', extensions: ['json'] } } : {}
  }
}

export function buildDisguisePreviewPayload(form) {
  return {
    trafficEncodeBody: form.trafficEncodeBody.trim(),
    trafficDecodeBody: form.trafficDecodeBody.trim()
  }
}

export function filterSystemDisguiseTemplates(disguises) {
  if (!Array.isArray(disguises)) return []
  return disguises.filter(disguise =>
    disguise?.createUserId === 'system' || disguise?.disguiseId?.includes('_1.0.0')
  )
}
