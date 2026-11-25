import http from '../http.js'

export function downloadTaskOutputApi(path, { signal } = {}) {
  return http.get('/platform/user/file/download', { params: { path }, signal, responseType: 'blob' })
}
