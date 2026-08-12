import http from '../http.js'

export function listSkillsApi(scope) {
  return http.get('/platform/skill/list', { params: { scope } })
}

export function getSkillTaxonomyApi() {
  return http.get('/platform/skill/taxonomy')
}

export function getSkillHealthApi(scope) {
  return http.get('/platform/skill/health', { params: { scope } })
}

export function saveSkillApi(params) {
  return http.post('/platform/skill/save', params)
}

export function deleteSkillApi(params) {
  return http.post('/platform/skill/delete', params)
}

export function deleteSkillsBatchApi(params) {
  return http.post('/platform/skill/delete/batch', params)
}

export function toggleSkillApi(params) {
  return http.post('/platform/skill/toggle', params)
}

export function toggleSkillsBatchApi(params) {
  return http.post('/platform/skill/toggle/batch', params)
}

export function searchSkillsApi(scope, keyword) {
  return http.get('/platform/skill/search', { params: { scope, keyword } })
}

// ── 文件级 API（skill 目录下的多文件管理） ───────────────────────────────────
export function listSkillFilesApi(scope, name) {
  return http.get('/platform/skill/files', { params: { scope, name } })
}

export function getSkillFileApi(scope, name, path) {
  return http.get('/platform/skill/file', { params: { scope, name, path } })
}

export function saveSkillFileApi(params) {
  return http.post('/platform/skill/file/save', params)
}

export function deleteSkillFileApi(params) {
  return http.post('/platform/skill/file/delete', params)
}

export function moveSkillFileApi(params) {
  return http.post('/platform/skill/file/move', params)
}

// ── 导入导出 ─────────────────────────────────────────────────────────
export function exportSkillApi(scope, name) {
  return http.get('/platform/skill/export', {
    params: { scope, name },
    responseType: 'blob'
  })
}

export function exportSkillsBatchApi(params) {
  return http.post('/platform/skill/export/batch', params, {
    responseType: 'blob'
  })
}

export function importSkillsApi(formData) {
  return http.post('/platform/skill/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}
