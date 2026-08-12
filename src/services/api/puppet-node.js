import http from '../http.js'

export function initPuppetApi(puppetId, projectId, hostId) {
  return http.get('/puppet-node/init', {
    params: { puppetId, ...(projectId ? { projectId } : {}), ...(hostId ? { hostId } : {}) }
  })
}

export function discoverPuppetHostsApi(puppetId, projectId, force = false) {
  return http.get('/puppet-node/discover-hosts', {
    params: { puppetId, ...(projectId ? { projectId } : {}), ...(force ? { force: true } : {}) }
  })
}

export function checkPuppetCacheApi(puppetId) {
  return http.get(`/puppet-node/check-cache?puppetId=${puppetId}`)
}

export function initPuppetCacheApi(puppetId, projectId, hostId) {
  return http.get('/puppet-node/init-cache', {
    params: { puppetId, ...(projectId ? { projectId } : {}), ...(hostId ? { hostId } : {}) }
  })
}

export function getPuppetCacheHostsApi(puppetId, projectId) {
  return http.get('/puppet-node/cache-hosts', {
    params: { puppetId, ...(projectId ? { projectId } : {}) }
  })
}

export function testPuppetConnApi(params) {
  return http.post('/puppet-node/test-conn', params)
}

export function testPuppetConfigApi(puppet) {
  return http.post('/puppet-node/test-config', puppet)
}

export function execCommandApi(params) {
  return http.post('/puppet-node/command/exec-command', params)
}

export function getBasicInfoApi(params) {
  return http.post('/puppet-node/basic-info', params)
}

export function getPuppetNodeCapabilitiesApi(params) {
  return http.post('/puppet-node/capabilities', params)
}
