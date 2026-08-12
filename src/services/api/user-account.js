import http from '../http.js'

export function listUsersApi(params) {
  return http.post('/puppet-node/user-account/list-users', params)
}

export function listGroupsApi(params) {
  return http.post('/puppet-node/user-account/list-groups', params)
}

export function queryUserApi(params) {
  return http.post('/puppet-node/user-account/query-user', params)
}

export function queryGroupApi(params) {
  return http.post('/puppet-node/user-account/query-group', params)
}

export function whoamiApi(params) {
  return http.post('/puppet-node/user-account/whoami', params)
}
