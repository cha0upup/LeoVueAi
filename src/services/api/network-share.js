import http from '../http.js'

export function listNetworkSharesApi(params) {
  return http.post('/puppet-node/network-share/list-shares', params)
}

export function listNetworkMountsApi(params) {
  return http.post('/puppet-node/network-share/list-mounts', params)
}

export function queryNetworkShareApi(params) {
  return http.post('/puppet-node/network-share/query-share', params)
}

export function connectNetworkShareApi(params) {
  return http.post('/puppet-node/network-share/connect', params)
}

export function disconnectNetworkShareApi(params) {
  return http.post('/puppet-node/network-share/disconnect', params)
}
