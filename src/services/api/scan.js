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

export function startPortScanApi(params) {
  return http.post('/puppet-node/port-scan/start-scan', params)
}

export function queryPortScanResultApi(params) {
  return http.post('/puppet-node/port-scan/query-result', params)
}

export function pausePortScanApi(params) {
  return http.post('/puppet-node/port-scan/pause-scan', params)
}

export function resumePortScanApi(params) {
  return http.post('/puppet-node/port-scan/resume-scan', params)
}

export function stopPortScanApi(params) {
  return http.post('/puppet-node/port-scan/stop-scan', params)
}

export function startFingerprintScanApi(params) {
  return http.post('/puppet-node/fingerprint/start-scan', params)
}

export function queryFingerprintScanResultApi(params) {
  return http.post('/puppet-node/fingerprint/query-result', params)
}

export function pauseFingerprintScanApi(params) {
  return http.post('/puppet-node/fingerprint/pause-scan', params)
}

export function resumeFingerprintScanApi(params) {
  return http.post('/puppet-node/fingerprint/resume-scan', params)
}

export function stopFingerprintScanApi(params) {
  return http.post('/puppet-node/fingerprint/stop-scan', params)
}

export function scanHostReachabilityApi(params) {
  return http.post('/puppet-node/host-reachable/scan', params, {
    timeout: resolveHostReachabilityRequestTimeout(params)
  })
}

export function startReconScanApi(params) {
  return http.post('/puppet-node/recon-scan/start-scan', params)
}

export function queryReconScanResultApi(params) {
  return http.post('/puppet-node/recon-scan/query-result', params)
}

export function pauseReconScanApi(params) {
  return http.post('/puppet-node/recon-scan/pause-scan', params)
}

export function resumeReconScanApi(params) {
  return http.post('/puppet-node/recon-scan/resume-scan', params)
}

export function stopReconScanApi(params) {
  return http.post('/puppet-node/recon-scan/stop-scan', params)
}
