import http from '../http.js'

export function listProcessesApi(params) {
  return http.post('/agent-node/process/list', params)
}

export function findProcessesApi(params) {
  return http.post('/agent-node/process/find', params)
}

export function killProcessApi(params) {
  return http.post('/agent-node/process/kill', params)
}
