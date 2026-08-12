import http from '../http.js'

export function getFileListApi(params) {
  return http.post('/puppet-node/file/list', params)
}

export function getFileSystemProfileApi(params) {
  return http.post('/puppet-node/file/profile', params)
}

export function downloadEngineStartApi(body) {
  return http.post('/puppet-node/file/download-engine/start', body)
}

export function downloadEngineProgressApi(body) {
  return http.post('/puppet-node/file/download-engine/progress', body)
}

export function downloadEngineCancelApi(body) {
  return http.post('/puppet-node/file/download-engine/cancel', body)
}

export function downloadEnginePauseApi(body) {
  return http.post('/puppet-node/file/download-engine/pause', body)
}

export function downloadEngineResumeApi(body) {
  return http.post('/puppet-node/file/download-engine/resume', body)
}

export function downloadEngineRetryApi(body) {
  return http.post('/puppet-node/file/download-engine/retry', body)
}

export function downloadEngineRemoveApi(body) {
  return http.post('/puppet-node/file/download-engine/remove', body)
}

export function downloadEngineTasksApi(body) {
  return http.post('/puppet-node/file/download-engine/tasks', body)
}

export function uploadEngineCancelApi(body) {
  return http.post('/puppet-node/file/upload-engine/cancel', body)
}

export function uploadEnginePauseApi(body) {
  return http.post('/puppet-node/file/upload-engine/pause', body)
}

export function uploadEngineResumeApi(body) {
  return http.post('/puppet-node/file/upload-engine/resume', body)
}

export function uploadEngineRetryApi(body) {
  return http.post('/puppet-node/file/upload-engine/retry', body)
}

export function uploadEngineRemoveApi(body) {
  return http.post('/puppet-node/file/upload-engine/remove', body)
}

export function uploadEngineTasksApi(body) {
  return http.post('/puppet-node/file/upload-engine/tasks', body)
}

export function downloadLocalFileApi(params) {
  return http.get('/puppet-node/file/download-local', {
    params,
    responseType: 'blob'
  })
}

export function uploadFileChunkApi(params) {
  return http.post('/puppet-node/file/upload-chunk', params)
}

export function previewFileApi(params) {
  return http.post('/puppet-node/file/preview', params)
}

export function previewFileChunkApi(params) {
  return http.post('/puppet-node/file/preview-chunk', params)
}

export function editFileApi(params) {
  return http.post('/puppet-node/file/edit', params)
}

export function newFileApi(params) {
  return http.post('/puppet-node/file/new-file', params)
}

export function moveFileApi(params) {
  return http.post('/puppet-node/file/move', params)
}

export function copyFileApi(params) {
  return http.post('/puppet-node/file/copy', params)
}

export function deleteFileApi(params) {
  return http.post('/puppet-node/file/delete', params)
}

export function newDirApi(params) {
  return http.post('/puppet-node/file/new-dir', params)
}

export function compressFileApi(params) {
  return http.post('/puppet-node/file/compress', params)
}

export function decompressFileApi(params) {
  return http.post('/puppet-node/file/decompress', params)
}

export function getFileMd5Api(params) {
  return http.post('/puppet-node/file/md5', params)
}

// ---- File Enhance ----
export function fileGrepApi(params) {
  return http.post('/puppet-node/file/enhance/grep', params)
}

export function fileTouchApi(params) {
  return http.post('/puppet-node/file/enhance/touch', params)
}

export function filePackApi(params) {
  return http.post('/puppet-node/file/enhance/pack', params)
}

export function renameFileApi(params) {
  return http.post('/puppet-node/file/enhance/rename', params)
}

export function chmodFileApi(params) {
  return http.post('/puppet-node/file/enhance/chmod', params)
}
