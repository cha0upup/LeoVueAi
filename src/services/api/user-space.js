import http from '../http.js'

export function userFileListApi(params = {}) {
  return http.get('/platform/user/file/list', { params })
}

export function archiveUserArtifactApi(data) {
  return http.post('/platform/user/file/archive', data)
}

export function userWorkspaceOverviewApi() {
  return http.get('/platform/user/file/overview')
}

export function userFileUploadApi(file, options = {}) {
  const formData = new FormData()
  formData.append('file', file)
  if (options.path) formData.append('path', options.path)
  if (options.filename) formData.append('filename', options.filename)
  if (options.overwrite) formData.append('overwrite', 'true')
  return http.post('/platform/user/file/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export function userFileDownloadApi(params) {
  return http.get('/platform/user/file/download', {
    params,
    responseType: 'blob'
  })
}

export function userFilePreviewApi(params) {
  return http.get('/platform/user/file/preview', { params })
}

export function userFileDeleteApi(params) {
  return http.post('/platform/user/file/delete', null, { params })
}
