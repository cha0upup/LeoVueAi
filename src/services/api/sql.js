import http from '../http.js'

export function testSqlConnectionApi(params, config) {
  return http.post('/puppet-node/sql/connections/test', params, config)
}

export function getSqlRuntimeCapabilitiesApi(params) {
  return http.post('/puppet-node/sql/runtime-capabilities', params)
}

export function getSqlDialectsApi() {
  return http.get('/puppet-node/sql/dialects')
}

export function getSqlDatabasesApi(params, config) {
  return http.post('/puppet-node/sql/metadata/databases', params, config)
}

export function getSqlTablesApi(params, config) {
  return http.post('/puppet-node/sql/metadata/tables', params, config)
}

export function getSqlTableColumnsApi(params, config) {
  return http.post('/puppet-node/sql/metadata/table-columns', params, config)
}

export function querySqlTableApi(params, config) {
  return http.post('/puppet-node/sql/data/query-table', params, config)
}

export function executeSqlQueryApi(params, config) {
  return http.post('/puppet-node/sql/query/execute', params, config)
}

export function createSqlDatabaseApi(params) {
  return http.post('/puppet-node/sql/databases/create', params)
}

export function createSqlTableApi(params) {
  return http.post('/puppet-node/sql/tables/create', params)
}

export function insertSqlRowApi(params) {
  return http.post('/puppet-node/sql/rows/insert', params)
}

export function updateSqlRowsApi(params) {
  return http.post('/puppet-node/sql/rows/update', params)
}

export function deleteSqlRowsApi(params) {
  return http.post('/puppet-node/sql/rows/delete', params)
}

export function exportSqlTableApi(params) {
  return http.post('/puppet-node/sql/export/table', params)
}

export function exportSqlDatabaseApi(params) {
  return http.post('/puppet-node/sql/export/database', params)
}

export function pauseSqlExportTaskApi(params) {
  return http.post('/puppet-node/sql/export/pause', params)
}

export function stopSqlExportTaskApi(params) {
  return http.post('/puppet-node/sql/export/stop', params)
}

export function resumeSqlExportTaskApi(params) {
  return http.post('/puppet-node/sql/export/resume', params)
}

export function getSqlExportTasksApi(params) {
  return http.post('/puppet-node/sql/export/tasks', params)
}
