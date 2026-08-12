const FILTER_FIELDS = [
  'userId',
  'userName',
  'puppetId',
  'puppetName',
  'sessionId',
  'operationType',
  'status',
  'clientIp',
  'keyword'
]

const FILTER_LABEL_TO_FIELD = Object.freeze({
  用户ID: 'userId',
  用户名: 'userName',
  主机ID: 'puppetId',
  主机名: 'puppetName',
  会话ID: 'sessionId',
  操作类型: 'operationType',
  状态: 'status',
  客户端IP: 'clientIp',
  关键词: 'keyword',
  时间范围: 'dateRange'
})

export function createAuditFilter() {
  return {
    userId: '',
    userName: '',
    puppetId: '',
    puppetName: '',
    sessionId: '',
    operationType: '',
    status: '',
    clientIp: '',
    keyword: '',
    dateRange: []
  }
}

export const AUDIT_OPERATION_TYPE_LABELS = Object.freeze({
  FILE_LIST: '获取文件列表',
  FILE_LIST_ROOT: '获取根目录文件列表',
  FILE_READ: '读取文件',
  FILE_EDIT: '编辑文件',
  FILE_NEW: '新建文件',
  FILE_MOVE: '移动文件',
  FILE_COPY: '复制文件',
  FILE_DELETE: '删除文件',
  FILE_NEW_DIR: '新建目录',
  FILE_COMPRESS: '文件压缩',
  FILE_DECOMPRESS: '文件解压',
  FILE_SEARCH: '搜索文件内容',
  FILE_UPLOAD: '上传文件',
  FILE_UPLOAD_CANCEL: '取消上传',
  FILE_DOWNLOAD: '下载文件',
  FILE_DOWNLOAD_LOCAL: '下载本地文件',
  FILE_DOWNLOAD_CANCEL: '取消下载',
  FILE_DOWNLOAD_RESUME: '恢复下载',
  FILE_MD5: '获取文件MD5',
  COMMAND_EXEC: '执行命令',
  COMMAND_STOP: '停止命令',
  COMPONENT_INVOKE: '调用组件',
  SQL_EXEC: '执行SQL',
  SQL_QUERY: '查询SQL',
  SQL_QUERY_TABLE: '查询表数据',
  SQL_TABLE_CREATE: '创建数据表',
  SQL_DATABASE_CREATE: '创建数据库',
  SQL_ROW_INSERT: '插入数据',
  SQL_ROW_UPDATE: '更新数据',
  SQL_ROW_DELETE: '删除数据',
  SQL_EXPORT_TABLE: '导出数据表',
  SQL_EXPORT_DATABASE: '导出数据库',
  SQL_EXPORT_PAUSE: '暂停SQL导出',
  SQL_EXPORT_STOP: '停止SQL导出',
  SQL_EXPORT_RESUME: '恢复SQL导出',
  SCREENSHOT: '屏幕截图',
  PLUGIN_INVOKE: '调用Java插件',
  PROXY_START: '启动SOCKS5代理',
  PROXY_STOP: '停止SOCKS5代理',
  RESOURCE_GET: '读取资源',
  EXEC_CLASS: '执行类',
  EXEC_SCRIPT: '执行脚本',
  FINGERPRINT_START: '启动指纹扫描',
  FINGERPRINT_QUERY: '查询指纹扫描',
  FINGERPRINT_PAUSE: '暂停指纹扫描',
  FINGERPRINT_RESUME: '继续指纹扫描',
  FINGERPRINT_STOP: '停止指纹扫描',
  RECON_START: '启动侦察扫描',
  RECON_QUERY: '查询侦察扫描',
  HOST_REACHABLE_SCAN: '主机存活扫描',
  PROCESS_LIST: '获取进程列表',
  PROCESS_FIND: '查找进程',
  PROCESS_KILL: '终止进程',
  SCHEDULED_TASK_LIST: '获取计划任务',
  SCHEDULED_TASK_QUERY: '查询计划任务',
  SCHEDULED_TASK_CREATE: '创建计划任务',
  SCHEDULED_TASK_DELETE: '删除计划任务',
  SCHEDULED_TASK_RUN: '运行计划任务',
  SCHEDULED_TASK_TOGGLE: '切换计划任务',
  EVENT_LOG_SOURCES: '获取日志源',
  EVENT_LOG_QUERY: '查询事件日志',
  EVENT_LOG_AGGREGATE: '聚合事件日志',
  EVENT_LOG_META: '获取事件元数据',
  EVENT_LOG_STATS: '获取事件统计',
  EVENT_LOG_CLEAR: '清除事件日志',
  SERVICE_LIST: '获取服务列表',
  SERVICE_QUERY: '查询服务',
  SERVICE_START: '启动服务',
  SERVICE_STOP: '停止服务',
  SERVICE_RESTART: '重启服务',
  SERVICE_TOGGLE_AUTO_START: '切换服务自启',
  SERVICE_CREATE: '创建服务',
  SERVICE_DELETE: '删除服务',
  HTTP_SENDER_SEND: '发送HTTP请求',
  HTTP_SENDER_FUZZ_START: '启动Fuzzer',
  HTTP_SENDER_FUZZ_QUERY: '查询Fuzzer',
  HTTP_SENDER_FUZZ_STOP: '停止Fuzzer',
  REGISTRY_QUERY: '查询注册表',
  REGISTRY_SEARCH: '搜索注册表',
  REGISTRY_ADD: '添加注册表值',
  REGISTRY_DELETE: '删除注册表',
  REGISTRY_EXPORT: '导出注册表',
  PORT_SCAN_START: '启动端口扫描',
  PORT_SCAN_QUERY: '查询端口扫描',
  PORT_SCAN_PAUSE: '暂停端口扫描',
  PORT_SCAN_RESUME: '继续端口扫描',
  PORT_SCAN_STOP: '停止端口扫描',
  PERSISTENCE_LIST: '获取持久化条目',
  PERSISTENCE_QUERY: '查询持久化条目',
  NETWORK_CONNECTION_LIST: '获取网络连接',
  NETWORK_CONNECTION_SUMMARY: '获取网络连接统计',
  FIREWALL_STATUS: '获取防火墙状态',
  FIREWALL_RULE_LIST: '获取防火墙规则',
  FIREWALL_ADD: '添加防火墙规则',
  FIREWALL_DELETE: '删除防火墙规则',
  FIREWALL_TOGGLE: '切换防火墙',
  INSTALLED_SOFTWARE_LIST_ALL: '获取软件列表',
  INSTALLED_SOFTWARE_SYSTEM: '获取系统软件',
  INSTALLED_SOFTWARE_USER: '获取用户软件',
  INSTALLED_SOFTWARE_SEARCH: '搜索软件',
  AUDIT_MODE_CHANGE: '变更审计模式',
  AUDIT_LOG_DELETE: '删除审计日志',
  AUDIT_LOG_CLEANUP: '清理审计日志'
})

export function buildAuditFilterParams(filter, overrides = {}) {
  const params = {}
  FILTER_FIELDS.forEach((field) => {
    const value = filter?.[field]
    if (typeof value === 'string' && value.trim()) params[field] = value.trim()
  })
  if (Array.isArray(filter?.dateRange) && filter.dateRange.length === 2) {
    if (filter.dateRange[0]) params.startTime = filter.dateRange[0]
    if (filter.dateRange[1]) params.endTime = filter.dateRange[1]
  }
  return { ...params, ...overrides }
}

export function getOperationTypeLabel(type) {
  return AUDIT_OPERATION_TYPE_LABELS[type] || type || '-'
}

export function getOperationTagType(operationType) {
  if (!operationType) return undefined
  if (operationType.startsWith('FILE_')) return 'primary'
  if (operationType.startsWith('COMMAND_')) return 'success'
  if (operationType.startsWith('SQL_')) return 'warning'
  if (operationType.startsWith('AUDIT_')) return 'danger'
  if (operationType === 'SCREENSHOT') return 'info'
  if (operationType.includes('PROXY')) return 'danger'
  return undefined
}

export function getStatusTagType(status) {
  return { SUCCESS: 'success', FAILED: 'warning', ERROR: 'danger' }[status]
}

export function getStatusLabel(status) {
  return { SUCCESS: '成功', FAILED: '失败', ERROR: '错误' }[status] || status || '-'
}

export function getStatusIndicatorStatus(status) {
  if (status === 'SUCCESS') return 'success'
  if (status === 'FAILED' || status === 'ERROR') return 'failed'
  if (status === 'PENDING') return 'waiting'
  return 'unconfigured'
}

export function getActiveAuditFilterSummary(filter) {
  const summary = {}
  const addText = (label, value, formatter = (item) => item) => {
    const normalized = typeof value === 'string' ? value.trim() : ''
    if (normalized) summary[label] = formatter(normalized)
  }
  addText('用户ID', filter?.userId)
  addText('用户名', filter?.userName)
  addText('主机ID', filter?.puppetId)
  addText('主机名', filter?.puppetName)
  addText('会话ID', filter?.sessionId)
  addText('操作类型', filter?.operationType, getOperationTypeLabel)
  addText('状态', filter?.status, getStatusLabel)
  addText('客户端IP', filter?.clientIp)
  addText('关键词', filter?.keyword)
  const [startTime, endTime] = Array.isArray(filter?.dateRange) ? filter.dateRange : []
  if (startTime && endTime) {
    summary['时间范围'] = `${startTime} ~ ${endTime}`
  }
  return summary
}

export function hasActiveAuditFilter(filter) {
  return Object.keys(getActiveAuditFilterSummary(filter)).length > 0
}

export function clearAuditFilterField(filter, label) {
  const field = FILTER_LABEL_TO_FIELD[label]
  if (!field || !filter) return false
  filter[field] = field === 'dateRange' ? [] : ''
  return true
}

export function formatAuditJson(value) {
  if (!value) return '-'
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    return JSON.stringify(parsed, null, 2)
  } catch {
    return String(value)
  }
}

export function formatAuditTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}
