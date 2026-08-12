import http from '../http.js'

// ==================== Repeater ====================

export function sendRawHttpApi(params) {
  return http.post('/puppet-node/http-sender/send', params)
}

// ==================== Fuzzer ====================

export function startFuzzApi(params) {
  return http.post('/puppet-node/http-sender/fuzz/start', params)
}

export function queryFuzzApi(params) {
  return http.post('/puppet-node/http-sender/fuzz/query', params)
}

export function stopFuzzApi(params) {
  return http.post('/puppet-node/http-sender/fuzz/stop', params)
}
