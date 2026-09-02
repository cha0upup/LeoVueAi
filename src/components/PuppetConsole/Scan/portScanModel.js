export const PORT_SCAN_KIND = 'port_scan'
export const HOST_REACHABILITY_KIND = 'host_reachability'

const toNonNegativeNumber = (value, fallback = 0) => {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : fallback
}

export const createPortScanTaskModel = ({
  taskId,
  scanHost,
  scanHosts = scanHost ? [scanHost] : [],
  scanPorts = [],
  scanTimeout,
  threadsNum,
  probeServices = true,
  createTime = Date.now()
}) => {
  const hosts = Array.isArray(scanHosts) && scanHosts.length > 0
    ? [...scanHosts]
    : scanHost ? [scanHost] : []
  const ports = Array.isArray(scanPorts) ? [...scanPorts] : []
  const targetCount = Math.max(1, hosts.length)
  const primaryHost = scanHost || hosts[0]
  const displayHost = scanHost || (hosts.length > 1 ? hosts.join(', ') : primaryHost)
  return {
    taskId,
    resultVersion: 1,
    scanKind: 'discovery',
    scanStage: probeServices !== false ? 'PORT_AND_SERVICE' : 'PORT',
    target: { host: primaryHost, protocol: 'tcp', source: 'port-scan' },
    scanHost: displayHost,
    scanHosts: hosts,
    targetCount: hosts.length,
    targets: hosts.map(host => ({ host, protocol: 'tcp', source: 'port-scan' })),
    scanPorts: ports,
    scanTimeout,
    threadsNum,
    probeServices: probeServices !== false,
    portLength: ports.length * targetCount,
    status: 'RUNNING',
    result: null,
    openPortList: [],
    openPortResults: [],
    serviceResults: [],
    scannedCount: 0,
    progress: 0,
    createTime,
    isQuerying: false,
    showOpenPorts: true
  }
}

export const applyPortScanResult = (task, result) => {
  const reportedPortLength = toNonNegativeNumber(result?.portLength)
  const portLength = reportedPortLength > 0 ? reportedPortLength : toNonNegativeNumber(task.portLength)
  const scannedCount = Math.min(toNonNegativeNumber(result?.scannedCount), portLength || Infinity)
  task.portLength = portLength
  if (result?.resultVersion != null) task.resultVersion = Number(result.resultVersion) || 1
  if (result?.scanKind) task.scanKind = result.scanKind
  if (result?.scanStage) task.scanStage = result.scanStage
  if (result?.target && typeof result.target === 'object') task.target = result.target
  if (Array.isArray(result?.scanPorts)) task.scanPorts = result.scanPorts
  if (result?.scanTimeout != null) task.scanTimeout = Number(result.scanTimeout) || task.scanTimeout
  if (result?.threadsNum != null) task.threadsNum = Number(result.threadsNum) || task.threadsNum
  if (result?.probeServices != null) task.probeServices = result.probeServices !== false
  if (result?.createdAt != null) task.createTime = Number(result.createdAt) || task.createTime
  if (result?.finishedAt != null) task.endTime = Number(result.finishedAt) || task.endTime
  if (Array.isArray(result?.targets)) {
    task.targets = result.targets
    task.scanHosts = result.targets
      .map(target => target?.host)
      .filter(host => typeof host === 'string' && host.length > 0)
    task.targetCount = Number(result.targetCount) || task.scanHosts.length
    if (task.scanHosts.length === 1) task.scanHost = task.scanHosts[0]
    else if (task.scanHosts.length > 1) task.scanHost = task.scanHosts.join(', ')
  }
  if (typeof result?.scanHost === 'string' && result.scanHost) task.scanHost = result.scanHost
  task.openPortList = Array.isArray(result?.openPortList) ? result.openPortList : []
  task.openPortResults = Array.isArray(result?.openPortResults) ? result.openPortResults : []
  const reportedServices = Array.isArray(result?.serviceResults)
    ? result.serviceResults
    : result?.results
  task.serviceResults = Array.isArray(reportedServices) ? reportedServices : []
  task.scannedCount = Number.isFinite(scannedCount) ? scannedCount : 0
  task.progress = portLength > 0 ? Math.min(100, Math.round((task.scannedCount / portLength) * 100)) : 0
  if (task.showOpenPorts == null) task.showOpenPorts = true
  if (task.status === 'STOPPED' && !task.endTime) task.endTime = Date.now()
  return task
}

export const getPortScanTaskStats = task => {
  const portLength = toNonNegativeNumber(task?.portLength)
  const scannedCount = toNonNegativeNumber(task?.scannedCount)
  const openCount = Array.isArray(task?.openPortResults) && task.openPortResults.length > 0
    ? task.openPortResults.length
    : Array.isArray(task?.openPortList) ? task.openPortList.length : 0
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
