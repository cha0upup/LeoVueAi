import http from '../http.js'

export function addPluginApi(pluginData) {
  return http.post('/platform/plugin-manage/plugins', pluginData)
}

export function updatePluginApi(pluginData) {
  return http.post('/platform/plugin-manage/plugins/update', pluginData)
}

export function deletePluginApi(params) {
  return http.post('/platform/plugin-manage/plugins/delete', params)
}

export function getPluginsApi() {
  return http.get('/platform/plugin-manage/plugins')
}

export function exportPluginApi(pluginId) {
  return http.get('/platform/plugin-manage/plugins/export', {
    params: { pluginId },
    responseType: 'blob'
  })
}

export function exportPluginsBatchApi(data) {
  return http.post('/platform/plugin-manage/plugins/export/batch', data, {
    responseType: 'blob'
  })
}

export function importPluginsApi(formData) {
  return http.post('/platform/plugin-manage/plugins/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}
