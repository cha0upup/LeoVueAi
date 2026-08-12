import http from '../http.js'

export function getSessionsApi(params = {}) {
  return http.get('/platform/session/sessions', { params })
}

export function deleteSessionApi(params) {
  return http.post('/platform/session/sessions/delete', params)
}

export function getConnLinkChainApi(params) {
  return http.post('/platform/session/conn-link-chain', params)
}

export function getCurrentHostIdApi(params) {
  return http.post('/platform/session/current-host-id', params)
}

export function setCurrentHostIdApi(params) {
  return http.post('/platform/session/current-host-id/set', params)
}

export function getAllHostIdsApi(params) {
  return http.post('/platform/session/all-host-ids', params)
}

// ─── 侦察摘要 ─────────────────────────────────────────────────────────────────

export function getReconSummaryApi(params) {
  return http.post('/platform/session/recon-summary', params)
}

export function setReconSummaryApi(params) {
  return http.post('/platform/session/recon-summary/set', params)
}

export function appendReconSummaryApi(params) {
  return http.post('/platform/session/recon-summary/append', params)
}

export function clearReconSummaryApi(params) {
  return http.post('/platform/session/recon-summary/clear', params)
}

export function organizeReconSummaryApi(params) {
  return http.post('/platform/session/recon-summary/organize', params, { timeout: 120000 })
}

export function generateReconSummaryDigestApi(params) {
  return http.post('/platform/session/recon-summary/digest/generate', params, { timeout: 120000 })
}

// ─── 侦察报告 ──────────────────────────────────────────────────────────────────

export function generateReconReportApi(params) {
  return http.post('/platform/session/report/generate', params)
}
