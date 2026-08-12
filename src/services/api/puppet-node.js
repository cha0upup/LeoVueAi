import http from '../http.js'

export function initPuppetApi(puppetId, projectId) {
  return http.get('/puppet-node/init', {
    params: { puppetId, ...(projectId ? { projectId } : {}) }
  })
}

export function checkPuppetCacheApi(puppetId) {
  return http.get(`/puppet-node/check-cache?puppetId=${puppetId}`)
}

export function initPuppetCacheApi(puppetId, projectId) {
  return http.get('/puppet-node/init-cache', {
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
