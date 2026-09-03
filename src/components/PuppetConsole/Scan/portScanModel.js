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

const inferService = port => {
  const services = {
    21: 'ftp', 22: 'ssh', 23: 'telnet', 25: 'smtp', 53: 'dns',
    80: 'http', 81: 'http', 110: 'pop3', 143: 'imap', 443: 'https',
    445: 'smb', 1433: 'mssql', 1521: 'oracle', 3306: 'mysql',
    3389: 'rdp', 5432: 'postgresql', 5900: 'vnc', 5901: 'vnc',
    6379: 'redis', 8080: 'http', 8081: 'http', 8443: 'https',
    8888: 'http', 9000: 'http', 9090: 'http', 9200: 'elasticsearch',
    11211: 'memcached', 27017: 'mongodb', 27018: 'mongodb'
  }
  return services[Number(port)] || null
}

const uniqueValues = values => [...new Set((Array.isArray(values) ? values : []).filter(value => value != null))]

/** Convert the unified node observation stream into the discovery view model. */
export const normalizeNetworkProbeResult = result => {
  const observations = Array.isArray(result?.observations) ? result.observations : []
  const targets = Array.isArray(result?.targets) ? result.targets : []
  const connectObservations = observations.filter(observation =>
    observation?.stage === 'tcp-connect' && observation?.state === 'open'
  )
  const exchangeByTarget = new Map(
    observations
      .filter(observation => observation?.stage === 'tcp-exchange')
      .map(observation => [`${observation.host}:${observation.port}`, observation])
  )
  const openPortResults = connectObservations.map(observation => {
    const port = Number(observation.port)
    const service = inferService(port)
    const resultEntry = {
      host: observation.host,
      port,
      transport: 'tcp',
      state: 'open',
      service,
      confidence: service ? 0.35 : 0.1,
      probe: 'connect'
    }
    const exchange = exchangeByTarget.get(`${observation.host}:${observation.port}`)
    const evidence = exchange?.evidence
    if (exchange) resultEntry.probe = 'tcp-exchange'
    if (evidence?.banner) resultEntry.banner = evidence.banner
    if (evidence?.statusCode != null) {
      resultEntry.statusCode = evidence.statusCode
      resultEntry.service = resultEntry.service || 'http'
      resultEntry.confidence = 0.9
    }
    if (evidence?.server) resultEntry.server = evidence.server
    if (evidence?.location) resultEntry.location = evidence.location
    if (evidence?.contentType) resultEntry.contentType = evidence.contentType
    if (exchange?.error) resultEntry.probeError = exchange.error
    return resultEntry
  })
  const scanHosts = uniqueValues(targets.map(target => target?.host).filter(Boolean))
  const scanPorts = uniqueValues(targets.map(target => Number(target?.port)).filter(port => Number.isFinite(port)))
  const stages = result?.plan?.stages || []
  const probeServices = stages.includes('tcp-exchange')
  return {
    ...result,
    scanKind: 'discovery',
    scanStage: probeServices ? 'PORT_AND_SERVICE' : 'PORT',
    target: scanHosts.length ? { host: scanHosts[0], protocol: 'tcp', source: 'network-probe' } : null,
    scanHosts,
    scanHost: scanHosts.length > 1 ? scanHosts.join(', ') : (scanHosts[0] || ''),
    targetCount: scanHosts.length,
    scanPorts,
    portLength: toNonNegativeNumber(result?.total),
    scannedCount: toNonNegativeNumber(result?.completed),
    scanTimeout: result?.plan?.timeout,
    threadsNum: result?.plan?.threads,
    openPortList: openPortResults.map(entry => entry.port),
    openPortResults,
    serviceResults: probeServices ? openPortResults : [],
    results: probeServices ? openPortResults : []
  }
}

export const applyPortScanResult = (task, result) => {
  const normalizedResult = normalizeNetworkProbeResult(result)
  const reportedPortLength = toNonNegativeNumber(normalizedResult?.portLength)
  const portLength = reportedPortLength > 0 ? reportedPortLength : toNonNegativeNumber(task.portLength)
  const scannedCount = Math.min(toNonNegativeNumber(normalizedResult?.scannedCount), portLength || Infinity)
  task.portLength = portLength
  if (normalizedResult?.resultVersion != null) task.resultVersion = Number(normalizedResult.resultVersion) || 1
  if (normalizedResult?.scanKind) task.scanKind = normalizedResult.scanKind
  if (normalizedResult?.scanStage) task.scanStage = normalizedResult.scanStage
  if (normalizedResult?.target && typeof normalizedResult.target === 'object') task.target = normalizedResult.target
  if (Array.isArray(normalizedResult?.scanPorts)) task.scanPorts = normalizedResult.scanPorts
  if (normalizedResult?.scanTimeout != null) task.scanTimeout = Number(normalizedResult.scanTimeout) || task.scanTimeout
  if (normalizedResult?.threadsNum != null) task.threadsNum = Number(normalizedResult.threadsNum) || task.threadsNum
  if (normalizedResult?.probeServices != null) task.probeServices = normalizedResult.probeServices !== false
  if (normalizedResult?.createdAt != null) task.createTime = Number(normalizedResult.createdAt) || task.createTime
  if (normalizedResult?.finishedAt != null) task.endTime = Number(normalizedResult.finishedAt) || task.endTime
  if (Array.isArray(normalizedResult?.targets)) {
    task.targets = normalizedResult.targets
    task.scanHosts = Array.isArray(normalizedResult.scanHosts) ? normalizedResult.scanHosts : []
    task.targetCount = Number(normalizedResult.targetCount) || task.scanHosts.length
    if (task.scanHosts.length === 1) task.scanHost = task.scanHosts[0]
    else if (task.scanHosts.length > 1) task.scanHost = task.scanHosts.join(', ')
  }
  if (typeof normalizedResult?.scanHost === 'string' && normalizedResult.scanHost) task.scanHost = normalizedResult.scanHost
  task.openPortList = Array.isArray(normalizedResult?.openPortList) ? normalizedResult.openPortList : []
  task.openPortResults = Array.isArray(normalizedResult?.openPortResults) ? normalizedResult.openPortResults : []
  const reportedServices = Array.isArray(normalizedResult?.serviceResults)
    ? normalizedResult.serviceResults
    : normalizedResult?.results
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
