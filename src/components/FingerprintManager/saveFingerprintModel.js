const DEFAULT_TIMEOUT = 3000
const DEFAULT_MATCH = { field: 'body', operator: 'contains', value: '' }

const toTimeout = (value) => {
  if (value == null || value === '') return DEFAULT_TIMEOUT
  const timeout = Number(value)
  return Number.isFinite(timeout)
    ? Math.min(60000, Math.max(0, Math.round(timeout)))
    : DEFAULT_TIMEOUT
}

export const createEmptyRequest = () => ({
  method: 'GET',
  path: '/',
  timeout: DEFAULT_TIMEOUT,
  headers: [],
  body: ''
})

export const createEmptyFingerprintForm = () => ({
  fingerprintId: '',
  name: '',
  version: '1.0',
  tagsStr: '',
  infoAuthor: '',
  infoRemark: '',
  requestList: [createEmptyRequest()],
  versionExtractText: '',
  matchText: JSON.stringify(DEFAULT_MATCH, null, 2)
})

const normalizeRequest = (request) => ({
  method: String(request?.method || 'GET').toUpperCase(),
  path: String(request?.path || '/').trim() || '/',
  timeout: toTimeout(request?.timeout),
  body: String(request?.body ?? ''),
  ...(request?.charset ? { charset: request.charset } : {}),
  ...(request?.maxBodyBytes != null ? { maxBodyBytes: request.maxBodyBytes } : {})
})

export const loadFingerprintForm = (fingerprint) => {
  if (!fingerprint) return createEmptyFingerprintForm()
  const requests = fingerprint.rule?.requests
  return {
    fingerprintId: String(fingerprint.fingerprintId || ''),
    name: String(fingerprint.name || ''),
    version: String(fingerprint.info?.version ?? '1.0'),
    tagsStr: Array.isArray(fingerprint.tags) ? fingerprint.tags.join(', ') : '',
    infoAuthor: String(fingerprint.info?.author || ''),
    infoRemark: String(fingerprint.info?.remark || ''),
    requestList: requests?.length
      ? requests.map((request) => ({
          ...normalizeRequest(request),
          headers: Object.entries(request.headers || {}).map(([key, value]) => ({
            key,
            value: String(value ?? '')
          }))
        }))
      : [createEmptyRequest()],
    versionExtractText: fingerprint.rule?.version ? JSON.stringify(fingerprint.rule.version, null, 2) : '',
    matchText: JSON.stringify(fingerprint.rule?.match || DEFAULT_MATCH, null, 2)
  }
}

export const parseFingerprintTags = (value) => [
  ...new Set(
    String(value || '')
      .split(',')
      .map((tag) => tag.trim().toLowerCase().replace(/\s+/g, '-'))
      .filter(Boolean)
  )
]

const buildHeaders = (headers) => {
  const result = {}
  ;(Array.isArray(headers) ? headers : []).forEach((header) => {
    const key = String(header?.key ?? '').trim()
    if (key) result[key] = String(header?.value ?? '').trim()
  })
  return result
}

export const buildFingerprintPayload = (form) => {
  const requests = (form?.requestList || []).map((source) => {
    const { body, ...request } = normalizeRequest(source)
    const headers = buildHeaders(source.headers)
    if (Object.keys(headers).length) request.headers = headers
    if (!['GET', 'HEAD'].includes(request.method) && body.trim()) {
      request.body = body.trim()
    }
    return request
  })
  const info = { version: String(form?.version || '').trim() }
  const author = String(form?.infoAuthor || '').trim()
  const remark = String(form?.infoRemark || '').trim()
  if (author) info.author = author
  if (remark) info.remark = remark
  const payload = {
    name: String(form?.name || '').trim(),
    info,
    rule: { requests, match: JSON.parse(String(form?.matchText || '').trim()) }
  }
  if (String(form?.versionExtractText || '').trim()) {
    const version = JSON.parse(form.versionExtractText)
    if (!version || typeof version !== 'object' || Array.isArray(version)) {
      throw new Error('版本提取配置必须是 JSON 对象')
    }
    payload.rule.version = version
  }
  const tags = parseFingerprintTags(form?.tagsStr)
  if (tags.length) payload.tags = tags
  return payload
}
