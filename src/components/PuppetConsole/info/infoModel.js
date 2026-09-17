const hasMeasurement = value => value != null && value !== '' &&
  Number.isFinite(Number(value)) && Number(value) >= 0

export function formatMBValue(value) {
  if (!hasMeasurement(value)) return '—'
  const mb = Number(value)
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`
}

export const formatPercent = (value) => {
  return hasMeasurement(value) ? `${Number(value).toFixed(1)}%` : '—'
}

export function usagePercent(used, total) {
  if (!hasMeasurement(total) || !(total > 0) || !hasMeasurement(used)) return null
  return Math.min(100, Math.round((used / total) * 1000) / 10)
}

const remainingUsage = (total, free) => hasMeasurement(total) && hasMeasurement(free)
  ? usagePercent(Number(total) - Number(free), total) : null

export function getResourceUsage(info) {
  const hardware = info.HardwareInfo || {}
  const disks = [...(info.FileSystemInfo || [])].sort(
    (a, b) => (b.UsagePercent ?? -1) - (a.UsagePercent ?? -1)
  )
  return {
    memory: remainingUsage(hardware.TotalPhysicalMemoryMB, hardware.FreePhysicalMemoryMB),
    swap: remainingUsage(hardware.TotalSwapSpaceMB, hardware.FreeSwapSpaceMB),
    disks,
    capacityDisks: disks.filter(isCapacityFileSystem)
  }
}

const NON_CAPACITY_FILE_SYSTEMS = new Set([
  'devfs', 'devtmpfs', 'proc', 'procfs', 'sysfs', 'tmpfs', 'cgroup', 'cgroup2',
  'fdescfs', 'autofs', 'efivarfs', 'securityfs', 'debugfs', 'tracefs', 'pstore', 'mqueue',
  'hugetlbfs', 'configfs', 'binfmt_misc', 'rpc_pipefs', 'fusectl', 'nsfs', 'squashfs'
])

export function isCapacityFileSystem(disk) {
  const type = String(disk?.Type || disk?.fsType || '').toLowerCase().trim()
  return !NON_CAPACITY_FILE_SYSTEMS.has(type) && Number(disk?.TotalSpaceMB) > 0
}

export function getUsageType(usage) {
  if (!hasMeasurement(usage)) return 'info'
  return usage > 90 ? 'danger' : usage > 75 ? 'warning' : 'success'
}

export const getUsageColor = (usage) =>
  `var(--el-color-${getUsageType(usage)})`

export function isLocalAddress(ip) {
  const value = String(ip || '').split('%')[0].toLowerCase()
  return !value || /^(127\.|169\.254\.|0\.)/.test(value) ||
    ['::', '::1', '0:0:0:0:0:0:0:0', '0:0:0:0:0:0:0:1'].includes(value) ||
    /^fe[89ab][0-9a-f]:/.test(value)
}

export function getNetworkOverview(interfaces = []) {
  return (interfaces || []).filter(net => net.IsUp && !net.IsLoopback && !net.IsVirtual &&
    !net.IsPointToPoint && !/^(utun|tun|tap|wg|ppp|lo)\d*$/i.test(net.Name || ''))
    .map(net => ({ ...net, IPAddresses: (net.IPAddresses || []).filter(ip => !isLocalAddress(ip)) }))
    .filter(net => net.IPAddresses.length)
    .sort((a, b) => Number(b.IPAddresses.some(ip => !ip.includes(':'))) -
      Number(a.IPAddresses.some(ip => !ip.includes(':'))) ||
      String(a.Name || '').localeCompare(String(b.Name || '')))
}

export function getIPType(ip) {
  const value = String(ip || '').split('%')[0].toLowerCase()
  if (isLocalAddress(value)) return 'info'
  if (/^f[cd][0-9a-f]{2}:/.test(value)) return 'primary'
  const [first, second] = value.split('.').map(Number)
  const privateAddress =
    first === 10 ||
    (first === 192 && second === 168) ||
    (first === 172 && second >= 16 && second <= 31)
  return privateAddress ? 'primary' : 'success'
}

export const hasJavaInfo = (info) =>
  Boolean(
    info.JavaRuntimeInfo?.JVMName ||
    info.JavaRuntimeInfo?.JavaVersion ||
    info.JavaRuntimeInfo?.JavaHome ||
    info.JavaRuntimeInfo?.JavaVendor
  )
export const hasPhpInfo = (info) => Boolean(info.PhpRuntimeInfo?.PHPVersion)
export const hasMiddlewareInfo = (info) =>
  Boolean(
    info.MiddlewareInfo?.MiddlewareType ||
    info.MiddlewareInfo?.Version ||
    info.MiddlewareInfo?.ServerInfo ||
    info.MiddlewareInfo?.ContextPath
  )
