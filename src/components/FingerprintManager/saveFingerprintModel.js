const DEFAULT_TIMEOUT = 3000

const toTimeout = value => {
  if (value == null || value === '') return DEFAULT_TIMEOUT
  const timeout = Number(value)
  return Number.isFinite(timeout) ? Math.min(60000, Math.max(0, Math.round(timeout))) : DEFAULT_TIMEOUT
}

export const createEmptyVulnerability = () => ({
  title: '',
  cve: '',
  severity: '',
  description: '',
  exploitSkill: '',
  references: []
})

export const createEmptyRequest = (protocol = 'http') =>
  String(protocol).toLowerCase() === 'tcp'
    ? { body: '', timeout: DEFAULT_TIMEOUT }
    : { method: 'GET', path: '/', timeout: DEFAULT_TIMEOUT, headers: [], body: '' }

export const createEmptyFingerprintForm = () => ({
  fingerprintId: '',
  protocol: 'http',
  name: '',
  version: '1.0',
  tagsStr: '',
  infoAuthor: '',
  infoRemark: '',
  vulnerabilityList: [],
  requestList: [createEmptyRequest()],
  script: ''
})

export const normalizeRequestsForProtocol = (requests, protocol, ensureOne = true) => {
  const source = Array.isArray(requests) && requests.length
    ? requests
    : ensureOne
      ? [createEmptyRequest(protocol)]
      : []
  if (String(protocol).toLowerCase() === 'tcp') {
    return source.map(request => ({ body: String(request?.body ?? ''), timeout: toTimeout(request?.timeout) }))
  }
  return source.map(request => {
    const headers = Array.isArray(request?.headers)
      ? request.headers.map(header => ({ key: String(header?.key ?? ''), value: String(header?.value ?? '') }))
      : request?.headers && typeof request.headers === 'object'
        ? Object.entries(request.headers).map(([key, value]) => ({ key, value: String(value ?? '') }))
        : []
    return {
      method: String(request?.method || 'GET').toUpperCase(),
      path: String(request?.path ?? '/').trim() || '/',
      timeout: toTimeout(request?.timeout),
      headers,
      body: String(request?.body ?? '')
    }
  })
}

export const loadFingerprintForm = fingerprint => {
  if (!fingerprint) return createEmptyFingerprintForm()
  const protocol = String(fingerprint.protocol || '').toLowerCase() === 'tcp' ? 'tcp' : 'http'
  const vulnerabilities = Array.isArray(fingerprint.info?.vulnerabilities)
    ? fingerprint.info.vulnerabilities.map(item => ({
        title: String(item?.title ?? ''),
        cve: String(item?.cve ?? ''),
        severity: String(item?.severity ?? ''),
        description: String(item?.description ?? ''),
        exploitSkill: String(item?.exploitSkill ?? ''),
        references: Array.isArray(item?.references)
          ? item.references.map(reference => ({
              value: String(reference?.value ?? reference ?? '')
            }))
          : []
      }))
    : []
  return {
    fingerprintId: String(fingerprint.fingerprintId || ''),
    protocol,
    name: String(fingerprint.name || ''),
    version: String(fingerprint.info?.version ?? '1.0'),
    tagsStr: Array.isArray(fingerprint.tags)
      ? fingerprint.tags.join(', ')
      : String(fingerprint.tags || ''),
    infoAuthor: String(fingerprint.info?.author || ''),
    infoRemark: String(fingerprint.info?.remark || ''),
    vulnerabilityList: vulnerabilities,
    requestList: normalizeRequestsForProtocol(fingerprint.rule?.requests, protocol),
    script: String(fingerprint.rule?.script || '')
  }
}

export const parseFingerprintTags = value => [...new Set(
  String(value || '')
    .split(',')
    .map(tag => tag.trim().toLowerCase().replace(/\s+/g, '-'))
    .filter(Boolean)
)]

const buildHeaders = headers => {
  const result = {}
  ;(Array.isArray(headers) ? headers : []).forEach(header => {
    const key = String(header?.key ?? '').trim()
    if (key) result[key] = String(header?.value ?? '').trim()
  })
  return result
}

export const findIncompleteVulnerabilities = vulnerabilities =>
  (Array.isArray(vulnerabilities) ? vulnerabilities : []).filter(item => {
    if (String(item?.title || '').trim()) return false
    return Boolean(
      String(item?.cve || '').trim() ||
      String(item?.severity || '').trim() ||
      String(item?.description || '').trim() ||
      String(item?.exploitSkill || '').trim() ||
      item?.references?.some(reference => String(reference?.value || '').trim())
    )
  })

const buildVulnerabilities = vulnerabilities =>
  (Array.isArray(vulnerabilities) ? vulnerabilities : []).flatMap(item => {
    const title = String(item?.title || '').trim()
    if (!title) return []
    const result = { title }
    ;['cve', 'severity', 'description', 'exploitSkill'].forEach(key => {
      const value = String(item?.[key] || '').trim()
      if (value) result[key] = value
    })
    const references = (Array.isArray(item?.references) ? item.references : [])
      .map(reference => String(reference?.value ?? '').trim())
      .filter(Boolean)
    if (references.length) result.references = references
    return [result]
  })

export const buildFingerprintPayload = form => {
  const protocol = String(form?.protocol || '').toLowerCase() === 'tcp' ? 'tcp' : 'http'
  const requests = normalizeRequestsForProtocol(form?.requestList, protocol, false).map(request => {
    if (protocol === 'tcp') return request
    const result = { method: request.method, path: request.path, timeout: request.timeout }
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
    protocol,
    info,
    rule: { requests, script: String(form?.script || '').trim() }
  }
  const tags = parseFingerprintTags(form?.tagsStr)
  if (tags.length) payload.tags = tags
  return payload
}
