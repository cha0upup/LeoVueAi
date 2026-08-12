import http from '../http.js'

export function listDockerContainersApi(params) {
  return http.post('/puppet-node/docker/list-containers', params)
}

export function listDockerImagesApi(params) {
  return http.post('/puppet-node/docker/list-images', params)
}

export function inspectDockerContainerApi(params) {
  return http.post('/puppet-node/docker/inspect', params)
}

export function getDockerContainerLogsApi(params) {
  return http.post('/puppet-node/docker/logs', params)
}

export function listDockerNetworksApi(params) {
  return http.post('/puppet-node/docker/list-networks', params)
}

export function startDockerContainerApi(params) {
  return http.post('/puppet-node/docker/start', params)
}

export function stopDockerContainerApi(params) {
  return http.post('/puppet-node/docker/stop', params)
}

export function restartDockerContainerApi(params) {
  return http.post('/puppet-node/docker/restart', params)
}

export function pauseDockerContainerApi(params) {
  return http.post('/puppet-node/docker/pause', params)
}

export function unpauseDockerContainerApi(params) {
  return http.post('/puppet-node/docker/unpause', params)
}

export function removeDockerContainerApi(params) {
  return http.post('/puppet-node/docker/remove-container', params)
}

export function removeDockerImageApi(params) {
  return http.post('/puppet-node/docker/remove-image', params)
}
