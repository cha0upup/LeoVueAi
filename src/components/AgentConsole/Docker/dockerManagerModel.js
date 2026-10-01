export const DOCKER_TAB_CONFIG = Object.freeze({
  containers: Object.freeze({
    label: '容器',
    listKey: 'containers',
    filename: 'docker-containers.tsv',
    columns: Object.freeze(['id', 'name', 'image', 'status', 'ports', 'created'])
  }),
  images: Object.freeze({
    label: '镜像',
    listKey: 'images',
    filename: 'docker-images.tsv',
    columns: Object.freeze(['repository', 'tag', 'id', 'size', 'created'])
  }),
  networks: Object.freeze({
    label: '网络',
    listKey: 'networks',
    filename: 'docker-networks.tsv',
    columns: Object.freeze(['id', 'name', 'driver', 'scope'])
  })
})

export function getDockerPayload(response) {
  const data = response?.data?.data
  return data && typeof data === 'object' ? data : {}
}

export function normalizeDockerList(response, tab) {
  const config = DOCKER_TAB_CONFIG[tab]
  if (!config) return []
  const list = getDockerPayload(response)[config.listKey]
  return Array.isArray(list) ? list : []
}

export function getDockerResourceId(row) {
  return row && typeof row === 'object' && row.id ? String(row.id) : ''
}

export function isDockerContainerRunning(status) {
  return typeof status === 'string' && status.toLowerCase().includes('up')
}

export function isDockerContainerPaused(status) {
  return typeof status === 'string' && status.toLowerCase().includes('paused')
}

export function getDockerStatusTag(status) {
  if (typeof status !== 'string') return 'info'
  const normalized = status.toLowerCase()
  if (normalized.includes('paused')) return 'warning'
  if (normalized.includes('up')) return 'success'
  if (normalized.includes('exited')) return 'danger'
  if (normalized.includes('created')) return 'warning'
  return 'info'
}

export function getDockerExportConfig(tab) {
  const config = DOCKER_TAB_CONFIG[tab]
  return config ? {
    filename: config.filename,
    columns: config.columns.map((key) => ({ label: key, key }))
  } : null
}

export function formatDockerInfo(response, key, emptyText = '') {
  const data = getDockerPayload(response)
  const value = data[key]
  if (typeof value === 'string') return value || emptyText
  if (value !== undefined) return JSON.stringify(value, null, 2)
  return Object.keys(data).length ? JSON.stringify(data, null, 2) : emptyText
}

export function quoteShellArg(value) {
  return `'${String(value ?? '').replaceAll("'", "'\"'\"'")}'`
}
