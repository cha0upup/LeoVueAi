import http from '../http.js'

export function getFingerprintsApi() {
  return http.get('/platform/fingerprint-manage/fingerprints')
}

export function getFingerprintsByProtocolApi(params) {
  return http.post('/platform/fingerprint-manage/fingerprints/by-protocol', params)
}

export function getFingerprintDetailApi(params) {
  return http.post('/platform/fingerprint-manage/fingerprints/get', params)
}

export function saveFingerprintApi(data) {
  return http.post('/platform/fingerprint-manage/fingerprints/save', data)
}

export function deleteFingerprintApi(params) {
  return http.post('/platform/fingerprint-manage/fingerprints/delete', params)
}

export function exportFingerprintApi(fingerprintId) {
  return http.get('/platform/fingerprint-manage/fingerprints/export', {
    params: { fingerprintId },
    responseType: 'blob'
  })
}

export function exportFingerprintsBatchApi(data) {
  return http.post('/platform/fingerprint-manage/fingerprints/export/batch', data, {
    responseType: 'blob'
  })
}

export function importFingerprintsApi(formData) {
  return http.post('/platform/fingerprint-manage/fingerprints/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}
