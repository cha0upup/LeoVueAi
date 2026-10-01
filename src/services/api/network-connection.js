import http from '../http.js'

export function listNetworkConnectionsApi(params) {
  return http.post('/agent-node/network-connection/list', params)
}

export function networkConnectionSummaryApi(params) {
  return http.post('/agent-node/network-connection/summary', params)
}
