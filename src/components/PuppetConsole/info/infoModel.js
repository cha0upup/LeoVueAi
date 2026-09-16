export function formatMBValue(value) {
  const mb = Math.max(0, Number(value) || 0)
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`
}

export const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`

export function usagePercent(used, total) {
  if (!(total > 0) || !Number.isFinite(Number(used))) return 0
  return Math.min(100, Math.max(0, Math.round((used / total) * 100)))
}

export function getResourceUsage(info) {
  const hardware = info.HardwareInfo || {}
  return {
    memory: usagePercent(
      hardware.TotalPhysicalMemoryMB - hardware.FreePhysicalMemoryMB,
      hardware.TotalPhysicalMemoryMB
    ),
    swap: usagePercent(
      hardware.TotalSwapSpaceMB - hardware.FreeSwapSpaceMB,
      hardware.TotalSwapSpaceMB
    ),
    disks: [...(info.FileSystemInfo || [])].sort(
      (a, b) => (b.UsagePercent || 0) - (a.UsagePercent || 0)
    )
  }
}

export function getUsageType(usage) {
  return usage > 90 ? 'danger' : usage > 75 ? 'warning' : 'success'
}

export const getUsageColor = (usage) =>
  ({ danger: '#cf4e57', warning: '#c27a1f', success: '#3f9a57' })[getUsageType(usage)]

export function getIPType(ip) {
  if (ip.startsWith('127.') || ip === '::1') return 'info'
  const [first, second] = ip.split('.').map(Number)
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
