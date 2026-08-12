import http from '../http.js'

export function addDisguiseApi(params) {
  return http.post('/platform/disguise-manager/add-disguise', params)
}

export function updateDisguiseApi(params) {
  return http.post('/platform/disguise-manager/update-disguises', params)
}

export function deleteDisguiseApi(params) {
  return http.post('/platform/disguise-manager/del-disguise', params)
}

export function getDisguisesApi() {
  return http.get('/platform/disguise-manager/disguises')
}

export function getDisguiseDetailApi(params) {
  return http.post('/platform/disguise-manager/disguises/get', params)
}

export function testDisguiseApi(params) {
  return http.post('/platform/disguise-manager/test-disguises', params)
}

export function testRuntimeDisguiseApi(params) {
  return http.post('/platform/disguise-manager/test-disguises/runtime', params)
}

export function previewDisguiseApi(params) {
  return http.post('/platform/disguise-manager/preview', params)
}

export function exportDisguiseApi(disguiseId) {
  return http.get('/platform/disguise-manager/disguises/export', {
    params: { disguiseId },
    responseType: 'blob'
  })
}

export function exportDisguisesBatchApi(data) {
  return http.post('/platform/disguise-manager/disguises/export/batch', data, {
    responseType: 'blob'
  })
}

export function importDisguisesApi(formData) {
  return http.post('/platform/disguise-manager/disguises/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}
