import http from '../http.js'

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
  return http.post('/puppet-node/host-reachable/scan', params)
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
