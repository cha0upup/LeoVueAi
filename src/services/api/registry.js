import http from '../http.js'

export function queryRegistryApi(params) {
  return http.post('/puppet-node/registry/query', params)
}

export function searchRegistryApi(params) {
  return http.post('/puppet-node/registry/search', params)
}

export function addRegistryApi(params) {
  return http.post('/puppet-node/registry/add', params)
}

export function deleteRegistryApi(params) {
  return http.post('/puppet-node/registry/delete', params)
}

export function exportRegistryApi(params) {
  return http.post('/puppet-node/registry/export', params)
}
