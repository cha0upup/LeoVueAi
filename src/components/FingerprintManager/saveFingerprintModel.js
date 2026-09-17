const DEFAULT_TIMEOUT = 3000
const DEFAULT_MATCH = { field: 'body', operator: 'contains', value: '' }

const toTimeout = (value) => {
  if (value == null || value === '') return DEFAULT_TIMEOUT
  const timeout = Number(value)
  return Number.isFinite(timeout)
    ? Math.min(60000, Math.max(0, Math.round(timeout)))
    : DEFAULT_TIMEOUT
}

export const createEmptyVulnerability = () => ({
  title: '',
  cve: '',
  severity: '',
  description: '',
  exploitSkill: '',
  references: []
})

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
  vulnerabilityList: [],
  requestList: [createEmptyRequest()],
  versionExtractText: '',
  matchText: JSON.stringify(DEFAULT_MATCH, null, 2)
})

export const normalizeRequests = (requests, ensureOne = true) => {
  const source =
    Array.isArray(requests) && requests.length ? requests : ensureOne ? [createEmptyRequest()] : []
  return source.map((request) => {
    const headers = Array.isArray(request?.headers)
      ? request.headers.map((header) => ({
          key: String(header?.key ?? ''),
          value: String(header?.value ?? '')
        }))
      : request?.headers && typeof request.headers === 'object'
        ? Object.entries(request.headers).map(([key, value]) => ({
            key,
            value: String(value ?? '')
          }))
        : []
    return {
      method: String(request?.method || 'GET').toUpperCase(),
      path: String(request?.uri || request?.path || '/').trim() || '/',
      timeout: toTimeout(request?.timeout),
      headers,
      body: String(request?.body ?? ''),
      ...(request?.charset ? { charset: request.charset } : {}),
      ...(request?.maxBodyBytes != null ? { maxBodyBytes: request.maxBodyBytes } : {})
    }
  })
}

export const loadFingerprintForm = (fingerprint) => {
  if (!fingerprint) return createEmptyFingerprintForm()
  const vulnerabilities = Array.isArray(fingerprint.info?.vulnerabilities)
    ? fingerprint.info.vulnerabilities.map((item) => ({
        title: String(item?.title ?? ''),
        cve: String(item?.cve ?? ''),
        severity: String(item?.severity ?? ''),
        description: String(item?.description ?? ''),
        exploitSkill: String(item?.exploitSkill ?? ''),
        references: Array.isArray(item?.references)
          ? item.references.map((reference) => ({
              value: String(reference?.value ?? reference ?? '')
            }))
          : []
      }))
    : []
  return {
    fingerprintId: String(fingerprint.fingerprintId || ''),
    name: String(fingerprint.name || ''),
    version: String(fingerprint.info?.version ?? '1.0'),
    tagsStr: Array.isArray(fingerprint.tags)
      ? fingerprint.tags.join(', ')
      : String(fingerprint.tags || ''),
    infoAuthor: String(fingerprint.info?.author || ''),
    infoRemark: String(fingerprint.info?.remark || ''),
    vulnerabilityList: vulnerabilities,
    requestList: normalizeRequests(fingerprint.rule?.requests),
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

export const findIncompleteVulnerabilities = (vulnerabilities) =>
  (Array.isArray(vulnerabilities) ? vulnerabilities : []).filter((item) => {
    if (String(item?.title || '').trim()) return false
    return Boolean(
      String(item?.cve || '').trim() ||
      String(item?.severity || '').trim() ||
      String(item?.description || '').trim() ||
      String(item?.exploitSkill || '').trim() ||
      item?.references?.some((reference) => String(reference?.value || '').trim())
    )
  })

const buildVulnerabilities = (vulnerabilities) =>
  (Array.isArray(vulnerabilities) ? vulnerabilities : []).flatMap((item) => {
    const title = String(item?.title || '').trim()
    if (!title) return []
    const result = { title }
    ;['cve', 'severity', 'description', 'exploitSkill'].forEach((key) => {
      const value = String(item?.[key] || '').trim()
      if (value) result[key] = value
    })
    const references = (Array.isArray(item?.references) ? item.references : [])
      .map((reference) => String(reference?.value ?? '').trim())
      .filter(Boolean)
    if (references.length) result.references = references
    return [result]
  })

export const buildFingerprintPayload = (form) => {
  const requests = normalizeRequests(form?.requestList, false).map((request) => {
    const result = { method: request.method, path: request.path, timeout: request.timeout }
    if (request.charset) result.charset = request.charset
    if (request.maxBodyBytes != null) result.maxBodyBytes = request.maxBodyBytes
    const headers = buildHeaders(request.headers)
    if (Object.keys(headers).length) result.headers = headers
    if (!['GET', 'HEAD'].includes(request.method) && request.body.trim()) {
      result.body = request.body.trim()
    }
    return result
  })
  const info = { version: String(form?.version || '').trim() }
  const author = String(form?.infoAuthor || '').trim()
  const remark = String(form?.infoRemark || '').trim()
  if (author) info.author = author
  if (remark) info.remark = remark
  const vulnerabilities = buildVulnerabilities(form?.vulnerabilityList)
  if (vulnerabilities.length) info.vulnerabilities = vulnerabilities
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
