import http from '../http.js'

export function listNetworkConnectionsApi(params) {
  return http.post('/puppet-node/network-connection/list', params)
}

export function networkConnectionSummaryApi(params) {
  return http.post('/puppet-node/network-connection/summary', params)
}
