const DATABASE_ERROR_MESSAGES = Object.freeze({
  DRIVER_NOT_FOUND: '数据库驱动未就绪，请检查运行时驱动配置',
  PROVIDER_NOT_FOUND: '数据库运行时组件未就绪',
  URL_MISMATCH: '连接地址与驱动类型不匹配',
  INVALID_ARGUMENT: '数据库请求参数有误',
  QUERY_TIMEOUT: '数据库查询超时，请缩小查询范围或调整超时设置',
  CONNECTION_ERROR: '数据库连接中断，请检查网络和连接配置',
  CONNECTION_TIMEOUT: '数据库连接超时，请检查网络和连接配置',
  AUTHENTICATION_ERROR: '数据库认证失败，请检查账号信息',
  AUTHENTICATION_FAILED: '数据库认证失败，请检查账号信息',
  TRANSACTION_ROLLBACK: '数据库事务已回滚，可稍后重试',
  SQL_ERROR: 'SQL 执行失败',
  EXECUTION_ERROR: '数据库执行器发生错误',
  COMPONENT_ERROR: '数据库运行时组件发生错误'
})

export function getDatabaseErrorPayload(error) {
  const payload = error?.response?.data
  return payload && typeof payload === 'object' ? payload : {}
}

export function formatDatabaseError(error, fallback = '数据库操作失败') {
  const payload = getDatabaseErrorPayload(error)
  const category = String(payload.errorCategory || '').trim().toUpperCase()
  const categoryMessage = DATABASE_ERROR_MESSAGES[category]
  const detail = payload.msg || error?.message || ''
  let message = categoryMessage || detail || fallback

  if (categoryMessage && detail && detail !== categoryMessage && detail !== fallback) {
    message += `：${detail}`
  }
  if (payload.sqlState) message += `（SQLState: ${payload.sqlState}）`
  return message
}

export function isRetryableDatabaseError(error) {
  return getDatabaseErrorPayload(error).retryable === true
}
