import http from '../http.js'

export function getProjectsApi() {
  return http.get('/platform/projects')
}

export function addProjectApi(project) {
  return http.post('/platform/projects', project)
}

export function updateProjectApi(project) {
  return http.post('/platform/projects/update', project)
}

export function archiveProjectApi(projectId) {
  return http.post('/platform/projects/archive', { projectId })
}

export function deleteProjectApi(projectId) {
  return http.post('/platform/projects/delete', { projectId })
}

export function getProjectAgentsApi(projectId) {
  return http.get(`/platform/projects/${encodeURIComponent(projectId)}/agents`)
}

export function getUnassignedAgentsApi() {
  return http.get('/platform/projects/unassigned/agents')
}

function getProjectAgentChildrenApi(projectId, parentAgentId) {
  return http.post(`/platform/projects/${encodeURIComponent(projectId)}/children`, {
    parentAgentId
  })
}

export function getWorkspaceAgentChildrenApi(projectId, parentAgentId) {
  const normalizedProjectId = String(projectId || '').trim()
  if (!normalizedProjectId) {
    return http.post('/platform/agent-manage/children', { parentAgentId })
  }
  return getProjectAgentChildrenApi(normalizedProjectId, parentAgentId)
}

export function attachProjectAgentsApi(projectId, agentIds, options = {}) {
  return http.post('/platform/projects/hosts/attach', { projectId, agentIds, ...options })
}

export function detachProjectAgentsApi(projectId, agentIds) {
  return http.post('/platform/projects/hosts/detach', { projectId, agentIds })
}

export function getAgentProjectMembershipsApi(agentIds) {
  return http.post('/platform/projects/hosts/memberships', { agentIds })
}
