import http from '../http.js'

export function startNetworkProbeWorkflowApi(params) {
  return http.post('/puppet-node/network-probe/workflow/start', params)
}

export function queryNetworkProbeWorkflowApi(params) {
  return http.post('/puppet-node/network-probe/workflow/query', params)
}

export function pauseNetworkProbeWorkflowApi(params) {
  return http.post('/puppet-node/network-probe/workflow/pause', params)
}

export function resumeNetworkProbeWorkflowApi(params) {
  return http.post('/puppet-node/network-probe/workflow/resume', params)
}

export function stopNetworkProbeWorkflowApi(params) {
  return http.post('/puppet-node/network-probe/workflow/stop', params)
}

export function deleteNetworkProbeWorkflowApi(params) {
  return http.post('/puppet-node/network-probe/workflow/delete', params)
}

export function previewNetworkProbeWorkflowApi(params) {
  return http.post('/puppet-node/network-probe/workflow/preview', params)
}

export function listNetworkProbeWorkflowTasksApi(params) {
  return http.post('/puppet-node/network-probe/workflow/tasks', params)
}

export function queryNetworkProbeWorkflowResultsApi(params) {
  return http.post('/puppet-node/network-probe/workflow/results/query', params)
}
