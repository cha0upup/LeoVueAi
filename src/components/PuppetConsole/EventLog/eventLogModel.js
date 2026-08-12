export const EVENT_LOG_FORMAT_OPTIONS = Object.freeze([
  { label: '原始行', value: '' },
  { label: 'Nginx access', value: 'nginx-access' },
  { label: 'Nginx error', value: 'nginx-error' },
  { label: 'Apache access', value: 'apache-access' },
  { label: 'Apache error', value: 'apache-error' },
  { label: 'Tomcat catalina', value: 'tomcat' },
  { label: 'MySQL error', value: 'mysql-error' },
  { label: 'MySQL slow', value: 'mysql-slow' }
])

export const EVENT_LOG_LEVEL_OPTIONS = Object.freeze([
  { label: 'Critical', value: 'critical' },
  { label: 'Error', value: 'error' },
  { label: 'Warning', value: 'warning' },
  { label: 'Info', value: 'info' },
  { label: 'Debug', value: 'debug' }
])

export const EVENT_LOG_SINCE_OPTIONS = Object.freeze([
  { label: '最近 15 分钟', value: '15m' },
  { label: '最近 1 小时', value: '1h' },
  { label: '最近 6 小时', value: '6h' },
  { label: '最近 1 天', value: '1d' },
  { label: '最近 7 天', value: '7d' }
])

export const EVENT_LOG_AGGREGATE_GROUP_OPTIONS = Object.freeze([
  { label: 'IP', value: 'ip' },
  { label: 'Path', value: 'path' },
  { label: '状态码', value: 'status' },
  { label: '状态码大类', value: 'statusClass' },
  { label: 'UA', value: 'ua' },
  { label: '方法', value: 'method' },
  { label: '级别', value: 'level' },
  { label: '按小时', value: 'hour' },
  { label: '按天', value: 'day' }
])

export const EVENT_LOG_MAX_BYTES_OPTIONS = Object.freeze([
  { label: '无限制', value: 0 },
  { label: '末尾 16MB', value: 16 * 1024 * 1024 },
  { label: '末尾 64MB', value: 64 * 1024 * 1024 },
  { label: '末尾 256MB', value: 256 * 1024 * 1024 },
  { label: '末尾 1GB', value: 1024 * 1024 * 1024 }
])

const SOURCE_ICONS = Object.freeze({
  eventlog: 'mdi:microsoft-windows',
  'unified-log': 'mdi:apple',
  journald: 'mdi:linux',
  nginx: 'simple-icons:nginx',
  apache: 'simple-icons:apache',
  tomcat: 'simple-icons:apachetomcat',
  mysql: 'simple-icons:mysql',
  redis: 'simple-icons:redis',
  postgres: 'simple-icons:postgresql',
  mongo: 'simple-icons:mongodb',
  kafka: 'simple-icons:apachekafka',
  rabbitmq: 'simple-icons:rabbitmq',
  elastic: 'simple-icons:elasticsearch',
  clickhouse: 'simple-icons:clickhouse',
  nodejs: 'mdi:nodejs',
  zookeeper: 'mdi:tree',
  file: 'mdi:file-document'
})

export function isEventLogAccessFormat(format) {
  return ['nginx-access', 'apache-access', 'combined'].includes(format)
}

export function resolveEventLogSourceIcon(type) {
  return SOURCE_ICONS[type] || 'mdi:text-box'
}

export function resolveHttpStatusTagType(code) {
  const status = Number.parseInt(code, 10)
  if (!Number.isFinite(status)) return 'info'
  if (status >= 500) return 'danger'
  if (status >= 400) return 'warning'
  if (status >= 300) return ''
  if (status >= 200) return 'success'
  return 'info'
}

export function getEventLogLevel(entry) {
  return entry?.Level || entry?.level || null
}

export function resolveEventLogLevelTagType(level) {
  const normalized = String(level || '').toLowerCase()
  if (['critical', 'crit', 'error', 'err'].includes(normalized)) return 'danger'
  if (['warning', 'warn'].includes(normalized)) return 'warning'
  if (['information', 'info'].includes(normalized)) return ''
  return 'info'
}

export function formatEventLogValue(value) {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return '[对象序列化失败]'
    }
  }
  return String(value)
}

export function formatEventLogTimestamp(timestamp) {
  if (!timestamp) return '-'
  const date = new Date(Number(timestamp))
  if (Number.isNaN(date.getTime())) return String(timestamp)
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function appendBoundedEventLogEntries(current, appended, limit = 1000) {
  const existing = Array.isArray(current) ? current : []
  const incoming = Array.isArray(appended) ? appended : []
  const maxEntries = Math.max(1, Math.floor(Number(limit) || 1))
  return existing.concat(incoming).slice(-maxEntries)
}

export function buildEventLogQueryParams(filters, options = {}) {
  return {
    source: filters.source || undefined,
    maxEntries: 200,
    keyword: filters.keyword || undefined,
    level: filters.level || undefined,
    since: options.since !== undefined ? options.since || undefined : filters.since || undefined,
    format: filters.format || undefined,
    cursor: options.cursor !== undefined ? options.cursor : undefined,
    direction: options.direction || undefined
  }
}

export function buildEventLogAggregateParams(filters) {
  return {
    source: filters.source,
    format: filters.format || undefined,
    groupBy: filters.groupBy,
    topN: filters.topN,
    maxBytes: filters.maxBytes || undefined,
    slow: filters.slow ? 'true' : undefined,
    keyword: filters.keyword || undefined,
    minStatus: filters.minStatus ?? undefined,
    maxStatus: filters.maxStatus ?? undefined
  }
}
