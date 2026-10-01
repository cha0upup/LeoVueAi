import http from '../http.js'

export function listScheduledTasksApi(params) {
  return http.post('/agent-node/scheduled-task/list', params)
}

export function queryScheduledTaskApi(params) {
  return http.post('/agent-node/scheduled-task/query', params)
}

export function createScheduledTaskApi(params) {
  return http.post('/agent-node/scheduled-task/create', params)
}

export function deleteScheduledTaskApi(params) {
  return http.post('/agent-node/scheduled-task/delete', params)
}
