import http from '../http.js'

export function listServicesApi(params) {
  return http.post('/puppet-node/service/list', params)
}

export function queryServiceApi(params) {
  return http.post('/puppet-node/service/query', params)
}

export function startServiceApi(params) {
  return http.post('/puppet-node/service/start', params)
}

export function stopServiceApi(params) {
  return http.post('/puppet-node/service/stop', params)
}

export function restartServiceApi(params) {
  return http.post('/puppet-node/service/restart', params)
}

export function toggleServiceAutoStartApi(params) {
  return http.post('/puppet-node/service/toggle-auto-start', params)
}

export function createServiceApi(params) {
  return http.post('/puppet-node/service/create', params)
}

export function deleteServiceApi(params) {
  return http.post('/puppet-node/service/delete', params)
}
