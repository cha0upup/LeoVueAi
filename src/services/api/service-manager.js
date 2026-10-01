import http from '../http.js'

export function listServicesApi(params) {
  return http.post('/agent-node/service/list', params)
}

export function queryServiceApi(params) {
  return http.post('/agent-node/service/query', params)
}

export function startServiceApi(params) {
  return http.post('/agent-node/service/start', params)
}

export function stopServiceApi(params) {
  return http.post('/agent-node/service/stop', params)
}

export function restartServiceApi(params) {
  return http.post('/agent-node/service/restart', params)
}

export function toggleServiceAutoStartApi(params) {
  return http.post('/agent-node/service/toggle-auto-start', params)
}

export function createServiceApi(params) {
  return http.post('/agent-node/service/create', params)
}

export function deleteServiceApi(params) {
  return http.post('/agent-node/service/delete', params)
}
