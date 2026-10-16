import http from '../http.js'

export function getApplicationInfoApi() {
  return http.get('/platform/application/info', { timeout: 5000 })
}
