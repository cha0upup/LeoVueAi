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

export function getProjectPuppetsApi(projectId) {
  return http.get(`/platform/projects/${encodeURIComponent(projectId)}/puppets`)
}

export function getUnassignedPuppetsApi() {
  return http.get('/platform/projects/unassigned/puppets')
}

export function getProjectPuppetChildrenApi(projectId, parentPuppetId) {
  return http.post(`/platform/projects/${encodeURIComponent(projectId)}/children`, {
    parentPuppetId
  })
}

export function attachProjectPuppetsApi(projectId, puppetIds, options = {}) {
  return http.post('/platform/projects/hosts/attach', { projectId, puppetIds, ...options })
}

export function detachProjectPuppetsApi(projectId, puppetIds) {
  return http.post('/platform/projects/hosts/detach', { projectId, puppetIds })
}

export function getPuppetProjectMembershipsApi(puppetIds) {
  return http.post('/platform/projects/hosts/memberships', { puppetIds })
}
