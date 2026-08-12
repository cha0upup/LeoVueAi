import http from '../http.js'

export function listPersistenceApi(params) {
  return http.post('/puppet-node/persistence/list', params)
}

export function queryPersistenceApi(params) {
  return http.post('/puppet-node/persistence/query', params)
}
