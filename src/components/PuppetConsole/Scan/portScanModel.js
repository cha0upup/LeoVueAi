export const PORT_SCAN_KIND = 'port_scan'
export const HOST_REACHABILITY_KIND = 'host_reachability'

const toNonNegativeNumber = (value, fallback = 0) => {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : fallback
}

export const createPortScanTaskModel = ({
  taskId,
  scanHost,
  scanPorts = [],
  scanTimeout,
  threadsNum,
  createTime = Date.now()
}) => ({
  taskId,
  scanHost,
  scanPorts: Array.isArray(scanPorts) ? [...scanPorts] : [],
  scanTimeout,
  threadsNum,
  portLength: Array.isArray(scanPorts) ? scanPorts.length : 0,
  status: 'RUNNING',
  result: null,
  openPortList: [],
  scannedCount: 0,
  progress: 0,
  createTime,
  isQuerying: false,
  showOpenPorts: true
})

export const applyPortScanResult = (task, result) => {
  const reportedPortLength = toNonNegativeNumber(result?.portLength)
  const portLength = reportedPortLength > 0 ? reportedPortLength : toNonNegativeNumber(task.portLength)
  const scannedCount = Math.min(toNonNegativeNumber(result?.scannedCount), portLength || Infinity)
  task.portLength = portLength
  task.openPortList = Array.isArray(result?.openPortList) ? result.openPortList : []
  task.scannedCount = Number.isFinite(scannedCount) ? scannedCount : 0
  task.progress = portLength > 0 ? Math.min(100, Math.round((task.scannedCount / portLength) * 100)) : 0
  if (task.showOpenPorts == null) task.showOpenPorts = true
  if (task.status === 'STOPPED' && !task.endTime) task.endTime = Date.now()
  return task
}

export const getPortScanTaskStats = task => {
  const portLength = toNonNegativeNumber(task?.portLength)
  const scannedCount = toNonNegativeNumber(task?.scannedCount)
  const openCount = Array.isArray(task?.openPortList) ? task.openPortList.length : 0
  return {
    portLength,
    scannedCount,
    openCount,
    missCount: Math.max(0, scannedCount - openCount),
    completed: task?.status === 'STOPPED' && scannedCount >= portLength
  }
}

export const mergeScanTasks = ({ port = [], tcp = [], http = [], recon = [] } = {}) => [
  ...port.map(task => ({ ...task, _kind: PORT_SCAN_KIND })),
  ...tcp.map(task => ({ ...task, _kind: 'fingerprint_tcp' })),
  ...http.map(task => ({ ...task, _kind: 'fingerprint_http' })),
  ...recon.map(task => ({ ...task, _kind: 'recon_scan' }))
].sort((left, right) => toNonNegativeNumber(right.createTime) - toNonNegativeNumber(left.createTime))

export const countActiveScanTasks = tasks =>
  (Array.isArray(tasks) ? tasks : []).filter(task => task?.status !== 'STOPPED').length

export const normalizeHostReachabilityResult = (data, fallbackTotal = 0) => {
  const reachableHostList = Array.isArray(data?.reachableHostList) ? data.reachableHostList : []
  const unreachableHostList = Array.isArray(data?.unreachableHostList) ? data.unreachableHostList : []
  const totalCount = toNonNegativeNumber(data?.totalCount, fallbackTotal)
  const reachableCount = toNonNegativeNumber(data?.reachableCount, reachableHostList.length)
  const unreachableCount = toNonNegativeNumber(
    data?.unreachableCount,
    Math.max(unreachableHostList.length, totalCount - reachableCount)
  )
  return { reachableHostList, unreachableHostList, totalCount, reachableCount, unreachableCount }
}
