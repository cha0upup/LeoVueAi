import http from '../http.js'

const HOST_REACHABILITY_WORKERS = 64
const HOST_REACHABILITY_DEFAULT_SCAN_TIMEOUT_MS = 3000
const HOST_REACHABILITY_MIN_REQUEST_TIMEOUT_MS = 30000
const HOST_REACHABILITY_MAX_COMPONENT_WAIT_MS = 300000
const HOST_REACHABILITY_TRANSPORT_BUFFER_MS = 15000

function resolveHostReachabilityRequestTimeout(params) {
  const hostCount = Math.max(1, Array.isArray(params?.scanHosts) ? params.scanHosts.length : 1)
  const configuredTimeout = Number(params?.scanTimeout)
  const scanTimeout = Number.isFinite(configuredTimeout) && configuredTimeout > 0
    ? configuredTimeout
    : HOST_REACHABILITY_DEFAULT_SCAN_TIMEOUT_MS
  const batches = Math.ceil(hostCount / HOST_REACHABILITY_WORKERS)
  const componentWait = Math.min(
    HOST_REACHABILITY_MAX_COMPONENT_WAIT_MS,
    batches * scanTimeout + 5000
  )

  return Math.max(
    HOST_REACHABILITY_MIN_REQUEST_TIMEOUT_MS,
    componentWait + HOST_REACHABILITY_TRANSPORT_BUFFER_MS
  )
}

export function startNetworkProbeApi(params) {
  return http.post('/puppet-node/network-probe/start', params)
}

export function queryNetworkProbeApi(params) {
  return http.post('/puppet-node/network-probe/query', params)
}

export function pauseNetworkProbeApi(params) {
  return http.post('/puppet-node/network-probe/pause', params)
}

export function resumeNetworkProbeApi(params) {
  return http.post('/puppet-node/network-probe/resume', params)
}

export function stopNetworkProbeApi(params) {
  return http.post('/puppet-node/network-probe/stop', params)
}

export function scanHostReachabilityApi(params) {
  return http.post('/puppet-node/network-probe/reachability', params, {
    timeout: resolveHostReachabilityRequestTimeout(params)
  })
}
