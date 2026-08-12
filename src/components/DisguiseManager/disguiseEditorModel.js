const DEFAULT_DISGUISE_VERSION = '1.0.0'
export const DEFAULT_DISGUISE_HEADERS = '{\n  "ContentType": "text/plain;charset=utf-8"\n}'
const DEFAULT_DISGUISE_ENCODE = `public byte[] encode(java.util.HashMap params) throws Exception {\n    String text = String.valueOf(params.getOrDefault("data", ""));\n    return text.getBytes(java.nio.charset.StandardCharsets.UTF_8);\n}`
const DEFAULT_DISGUISE_DECODE = `public java.util.HashMap decode(byte[] data) throws Exception {\n    java.util.HashMap result = new java.util.HashMap();\n    result.put("data", new String(data, java.nio.charset.StandardCharsets.UTF_8));\n    return result;\n}`
export const DEFAULT_PHP_ENCODE = `$json = json_encode(leo_wire_encode($payload), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);\nif ($json === false) { throw new RuntimeException('JSON encode failed'); }\nreturn base64_encode($json);`
export const DEFAULT_PHP_DECODE = `$json = base64_decode(preg_replace('/\\s+/', '', $body), true);\nif ($json === false) { throw new RuntimeException('Invalid base64 request'); }\n$decoded = json_decode($json, true);\nif (!is_array($decoded)) { throw new RuntimeException('Invalid JSON request'); }\nreturn leo_wire_decode($decoded);`

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
    encodeBody: disguise?.encodeBody || DEFAULT_DISGUISE_ENCODE,
    decodeBody: disguise?.decodeBody || DEFAULT_DISGUISE_DECODE,
    schemaVersion: disguise?.schemaVersion || 2,
    protocolVersion: disguise?.protocolVersion || 2,
    supportedRuntimes: runtimes,
    phpEncodeBody: disguise?.phpEncodeBody || (phpEnabled ? DEFAULT_PHP_ENCODE : ''),
    phpDecodeBody: disguise?.phpDecodeBody || (phpEnabled ? DEFAULT_PHP_DECODE : '')
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
    encodeBody: form.encodeBody?.trim(),
    decodeBody: form.decodeBody?.trim(),
    schemaVersion: phpEnabled ? 2 : form.schemaVersion,
    protocolVersion: phpEnabled ? 2 : form.protocolVersion,
    supportedRuntimes,
    phpEncodeBody: phpEnabled ? form.phpEncodeBody?.trim() : null,
    phpDecodeBody: phpEnabled ? form.phpDecodeBody?.trim() : null,
    requirements: phpEnabled ? { php: { minVersion: '7.4', extensions: ['json'] } } : {}
  }
}

export function buildDisguisePreviewPayload(form, testParamsText) {
  const payload = {
    encodeBody: form.encodeBody.trim(),
    decodeBody: form.decodeBody.trim()
  }
  try {
    const testParams = JSON.parse(testParamsText)
    if (testParams && typeof testParams === 'object' && !Array.isArray(testParams)) {
      payload.testParams = testParams
    }
  } catch {
    // The preview endpoint supplies deterministic defaults for invalid input JSON.
  }
  return payload
}

export function filterSystemDisguiseTemplates(disguises) {
  if (!Array.isArray(disguises)) return []
  return disguises.filter(disguise =>
    disguise?.createUserId === 'system' || disguise?.disguiseId?.includes('_1.0.0')
  )
}
