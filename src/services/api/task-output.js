import http from '../http.js'

export function downloadTaskOutputApi(params) {
  return http.get('/platform/user/file/download', { params, responseType: 'blob' })
}
