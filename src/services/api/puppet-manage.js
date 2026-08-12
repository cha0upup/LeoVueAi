import http from '../http.js'

export function getChildrenByParentPuppetIdApi(params) {
  return http.post('/platform/puppet-manage/children', params)
}

export function getPuppetsApi() {
  return http.get('/platform/puppet-manage/puppets')
}

export function addPuppetApi(puppetData, options = {}) {
  return http.post('/platform/puppet-manage/puppets', puppetData, {
    params: options.projectId ? { projectId: options.projectId } : {}
  })
}

export function exportPuppetsApi(puppetIds, options = {}) {
  return http.post('/platform/puppet-manage/puppets/export', { puppetIds, ...options })
}

export function updatePuppetApi(puppetData) {
  return http.post('/platform/puppet-manage/puppets/update', puppetData)
}

export function deletePuppetApi(params) {
  return http.post('/platform/puppet-manage/puppets/delete', params)
}

export function saveDatabaseConnectionApi(connectionConfig) {
  return http.post('/platform/puppet-manage/database-connections', connectionConfig)
}

export function getDatabaseConnectionsApi(params) {
  return http.post('/platform/puppet-manage/database-connections/list', params)
}

export function deleteDatabaseConnectionApi(params) {
  return http.post('/platform/puppet-manage/database-connections/delete', params)
}

export function updateDatabaseConnectionStatusApi(params) {
  return http.post('/platform/puppet-manage/database-connections/status', params)
}

export function probeUrlPathsApi(params) {
  return http.post('/platform/puppet-manage/url-probe', params)
}
