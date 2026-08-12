import http from '../http.js'

export function listAllSoftwareApi(params) {
  return http.post('/puppet-node/installed-software/list-all', params)
}
