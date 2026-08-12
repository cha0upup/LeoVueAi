import http from '../http.js'

export function inspectWebRuntimeApi(params) {
  return http.post('/puppet-node/web-runtime/inspect', params)
}

export function removeWebRuntimeComponentApi(params) {
  return http.post('/puppet-node/web-runtime/components/remove', params)
}

export function getClassBytecodeApi(params) {
  return http.post('/puppet-node/class-bytecode/get', params)
}

export function getLoadedComponentsApi(params) {
  return http.post('/puppet-node/get-loaded-components', params)
}

export function reloadComponentApi(params) {
  return http.post('/puppet-node/reload-component', params)
}

export function loadComponentApi(params) {
  return http.post('/puppet-node/load-component', params)
}
