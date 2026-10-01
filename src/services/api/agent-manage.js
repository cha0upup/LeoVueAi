import http from '../http.js'

export function getAgentsApi() {
  return http.get('/platform/agent-manage/agents')
}

export function addAgentApi(agentData, options = {}) {
  return http.post('/platform/agent-manage/agents', agentData, {
    params: options.projectId ? { projectId: options.projectId } : {}
  })
}

export function exportAgentsApi(agentIds, options = {}) {
  return http.post('/platform/agent-manage/agents/export', { agentIds, ...options })
}

export function updateAgentApi(agentData) {
  return http.post('/platform/agent-manage/agents/update', agentData)
}

export function deleteAgentApi(params) {
  return http.post('/platform/agent-manage/agents/delete', params)
}

export function saveDatabaseConnectionApi(connectionConfig) {
  return http.post('/platform/agent-manage/database-connections', connectionConfig)
}

export function getDatabaseConnectionsApi(params) {
  return http.post('/platform/agent-manage/database-connections/list', params)
}

export function deleteDatabaseConnectionApi(params) {
  return http.post('/platform/agent-manage/database-connections/delete', params)
}

export function updateDatabaseConnectionStatusApi(params) {
  return http.post('/platform/agent-manage/database-connections/status', params)
}

export function probeUrlPathsApi(params) {
  return http.post('/platform/agent-manage/url-probe', params)
}
