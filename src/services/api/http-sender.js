import http from '../http.js'

// ==================== Repeater ====================

export function sendRawHttpApi(params) {
  return http.post('/agent-node/http-sender/send', params)
}

// ==================== Fuzzer ====================

export function startFuzzApi(params) {
  return http.post('/agent-node/http-sender/fuzz/start', params)
}

export function queryFuzzApi(params) {
  return http.post('/agent-node/http-sender/fuzz/query', params)
}

export function stopFuzzApi(params) {
  return http.post('/agent-node/http-sender/fuzz/stop', params)
}
