import http from '../http.js'

export function getShellGeneratorSupportedTypesApi() {
  return http.get('/platform/shell-generator/supported-types')
}

export function generateWebShellApi(params) {
  return http.post('/platform/shell-generator/generate/webshell', params)
}

export function generateMemoryShellApi(params) {
  return http.post('/platform/shell-generator/generate/memoryshell', params)
}

export function generateRuntimeScriptApi(params) {
  return http.post('/platform/shell-generator/generate/runtime', params)
}

export function getObfuscationStepsApi() {
  return http.get('/platform/shell-generator/obfuscation-steps')
}

export function getShellResultApi(resultId) {
  return http.get(`/platform/shell-generator/result/${resultId}`)
}
