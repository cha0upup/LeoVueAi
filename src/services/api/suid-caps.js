import http from '../http.js'

export function listSuidFilesApi(params) {
  return http.post('/puppet-node/suid-caps/suid', params)
}

export function listSgidFilesApi(params) {
  return http.post('/puppet-node/suid-caps/sgid', params)
}

export function listCapabilitiesApi(params) {
  return http.post('/puppet-node/suid-caps/capabilities', params)
}

export function listAllSuidCapsApi(params) {
  return http.post('/puppet-node/suid-caps/all', params)
}
