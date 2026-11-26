import http from '../http.js'

export function getAllUsersApi(options) {
  return http.get('/platform/admin/users', options)
}

export function getTeamLeaderOptionsApi({ signal } = {}) {
  return http.get('/platform/admin/users/no-team', { params: { view: 'options' }, signal })
}

export function getEnabledUserOptionsApi({ signal } = {}) {
  return http.get('/platform/admin/users/enabled-options', { signal })
}

export function getAuditLogSummaryPageApi(params, { signal } = {}) {
  return http.get('/platform/admin/audit-logs', { params: { ...params, view: 'summary' }, signal })
}

export function getAuditLogDetailApi(logId, { signal } = {}) {
  return http.get('/platform/admin/audit-logs/detail', { params: { logId }, signal })
}

export function cleanupAuditLogsApi(params) {
  return http.post('/platform/admin/audit-logs/cleanup', params)
}

export function deleteAuditLogsApi(params) {
  return http.post('/platform/admin/audit-logs/delete', params)
}

export function deleteFilteredAuditLogsApi(params) {
  return http.post('/platform/admin/audit-logs/delete-filtered', params)
}

export function getAuditLogOperationTypesApi() {
  return http.get('/platform/admin/audit-logs/operation-types')
}

export function getAuditModeApi() {
  return http.get('/platform/admin/audit-logs/mode')
}

export function updateAuditModeApi(params) {
  return http.post('/platform/admin/audit-logs/mode', params)
}

export function getAuditUserStatisticsApi(params, { signal } = {}) {
  return http.get('/platform/admin/audit-logs/statistics/user', { params, signal })
}

export function getAuditTeamStatisticsApi(params, { signal } = {}) {
  return http.get('/platform/admin/audit-logs/statistics/team', { params, signal })
}

export function getAuditAgentStatisticsApi(params, { signal } = {}) {
  return http.get('/platform/admin/audit-logs/statistics/agent', { params, signal })
}

export function getAuditOperationStatisticsApi(params, { signal } = {}) {
  return http.get('/platform/admin/audit-logs/statistics/operations', { params, signal })
}

export function getAuditTrendStatisticsApi(params, { signal } = {}) {
  return http.get('/platform/admin/audit-logs/statistics/trend', { params, signal })
}

export function addUserApi(userData) {
  return http.post('/platform/admin/users', userData)
}

export function updateUserApi(userData) {
  return http.post('/platform/admin/users/update', userData)
}

export function deleteUserApi(params) {
  return http.post('/platform/admin/users/delete', params)
}

export function resetUserPasswordApi(params) {
  return http.post('/platform/admin/users/reset-password', params)
}

export function getAllTeamsApi(options) {
  return http.get('/platform/admin/teams', options)
}

export function addTeamApi(teamData) {
  return http.post('/platform/admin/teams', teamData)
}

export function deleteTeamApi(params) {
  return http.post('/platform/admin/teams/delete', params)
}

// ── AI 模型配置（ccswitch 风格的单层 CRUD） ────────────────────────────

const AI_MODEL_ROUTE = '/platform/admin/ai-models'
const AI_PROVIDER_ROUTE = '/platform/admin/ai-providers'

export function listAiProvidersApi() {
  return http.get(AI_PROVIDER_ROUTE)
}

export function createAiProviderApi(body) {
  return http.post(AI_PROVIDER_ROUTE, body)
}

export function updateAiProviderApi(id, body) {
  return http.put(`${AI_PROVIDER_ROUTE}/${id}`, body)
}

export function deleteAiProviderApi(id) {
  return http.delete(`${AI_PROVIDER_ROUTE}/${id}`)
}

export function listAiModelConfigsApi() {
  return http.get(AI_MODEL_ROUTE)
}

export function createAiModelConfigApi(body) {
  return http.post(AI_MODEL_ROUTE, body)
}

/** Resolves draft parameters locally on the backend; does not call the model vendor. */
export function previewAiModelRequestApi(body, options = {}) {
  return http.post(`${AI_MODEL_ROUTE}/request-preview`, body, options)
}

export function updateAiModelConfigApi(id, body) {
  return http.put(`${AI_MODEL_ROUTE}/${id}`, body)
}

export function activateAiModelConfigApi(id) {
  return http.post(`${AI_MODEL_ROUTE}/${id}/activate`)
}

export function testAiModelConfigConnectionApi(id) {
  return http.post(`${AI_MODEL_ROUTE}/${id}/test-connection`)
}

/** 真实发起最小无副作用请求，验证模型的文本、流式、工具、JSON 与 Reasoning 能力。 */
export function probeAiModelCapabilitiesApi(id) {
  return http.post(`${AI_MODEL_ROUTE}/${id}/probe-capabilities`)
}

export function listAiModelHealthApi() {
  return http.get(`${AI_MODEL_ROUTE}/health`)
}

export function getAiModelProvidersApi() {
  return http.get(`${AI_MODEL_ROUTE}/providers`)
}

export function listAiModelCapabilitiesApi() {
  return http.get(`${AI_MODEL_ROUTE}/capabilities`)
}

export function createAiModelCapabilityApi(body) {
  return http.post(`${AI_MODEL_ROUTE}/capabilities`, body)
}

export function updateAiModelCapabilityApi(modelName, body) {
  return http.put(`${AI_MODEL_ROUTE}/capabilities/${encodeURIComponent(modelName)}`, body)
}

export function deleteAiModelCapabilityApi(modelName) {
  return http.delete(`${AI_MODEL_ROUTE}/capabilities/${encodeURIComponent(modelName)}`)
}

export function fetchAiModelListApi(body, { signal } = {}) {
  return http.post(`${AI_MODEL_ROUTE}/fetch-models`, body, { signal })
}

export function fetchAiProviderModelListApi(providerId) {
  return http.post(`${AI_MODEL_ROUTE}/providers/${providerId}/fetch-models`)
}
