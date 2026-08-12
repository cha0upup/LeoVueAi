const TRUNCATION_MESSAGES = Object.freeze({
  MAX_ROWS: '结果达到运行时行数上限，仅展示部分数据',
  MAX_RESULT_BYTES: '结果达到传输大小上限，仅展示部分数据',
  MAX_CELL_BYTES: '至少一个字段超过单元格大小上限，内容已截断'
})

export const DEFAULT_DATABASE_QUERY_TIMEOUT_SECONDS = 30
export const MIN_DATABASE_QUERY_TIMEOUT_SECONDS = 1
export const MAX_DATABASE_QUERY_TIMEOUT_SECONDS = 300

export function normalizeDatabaseQueryTimeout(value) {
  const parsed = Number(value)
  return Number.isInteger(parsed) &&
    parsed >= MIN_DATABASE_QUERY_TIMEOUT_SECONDS &&
    parsed <= MAX_DATABASE_QUERY_TIMEOUT_SECONDS
    ? parsed
    : DEFAULT_DATABASE_QUERY_TIMEOUT_SECONDS
}

export function formatDatabaseResultSize(bytes) {
  const value = Number(bytes)
  if (!Number.isFinite(value) || value <= 0) return ''
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

export function getDatabaseTruncationMessage(result = {}) {
  const reason = String(result.truncationReason || '')
  const message = TRUNCATION_MESSAGES[reason] || '查询结果仅返回了部分数据'
  const size = formatDatabaseResultSize(result.resultBytes)
  return size ? `${message}（已接收 ${size}）` : message
}

export function isCanceledDatabaseRequest(error) {
  return error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError'
}
