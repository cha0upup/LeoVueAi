export function resolveApiBaseUrl(locationLike, configuredPort) {
  const origin = locationLike?.origin
  if (!origin) throw new Error('无法确定当前页面地址')

  const port = String(configuredPort || '').trim()
  if (!port) return origin

  const url = new URL(origin)
  url.port = port
  return url.origin
}
