import http from '../http.js'

export function listAllSoftwareApi(params) {
  return http.post('/agent-node/installed-software/list-all', params)
}
