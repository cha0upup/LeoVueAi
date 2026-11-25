import http from '../http.js'

export function initializeSystemApi(params) {
  return http.post('/platform/setup', params)
}

export function loginApi(params) {
  return http.post('/platform/user/login', params)
}

export function logoutApi() {
  return http.post('/platform/user/logout')
}

export function changePasswordApi(params) {
  return http.post('/platform/user/change-password', params)
}

export function getLoginStatusApi() {
  return http.get('/platform/user/status')
}

export function getProfileApi({ signal } = {}) {
  return http.get('/platform/user/profile', { signal })
}

export function updateProfileApi(params) {
  return http.post('/platform/user/profile', params)
}
