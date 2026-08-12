import http from '../http.js'

export function startScreenCaptureApi(params) {
  return http.post('/puppet-node/screen/start', params)
}

export function startSocks5ProxyApi(params) {
  return http.post('/puppet-node/proxy/start', params)
}

export function stopSocks5ProxyApi(params) {
  return http.post('/puppet-node/proxy/stop', params)
}

export function getSocks5StatusApi(params) {
  return http.post('/puppet-node/proxy/status', params)
}

export function getSocks5StatisticsApi(params) {
  return http.post('/puppet-node/proxy/statistics', params)
}

// ── HTTP 代理 ──────────────────────────────────────────────

export function startHttpProxyApi(params) {
  return http.post('/puppet-node/proxy/http/start', params)
}

export function stopHttpProxyApi(params) {
  return http.post('/puppet-node/proxy/http/stop', params)
}

export function getHttpProxyStatusApi(params) {
  return http.post('/puppet-node/proxy/http/status', params)
}

export function getHttpProxyStatisticsApi(params) {
  return http.post('/puppet-node/proxy/http/statistics', params)
}

// ── 本地端口转发 ────────────────────────────────────────────

export function startLocalForwardApi(params) {
  return http.post('/puppet-node/forward/start', params)
}

export function stopLocalForwardApi(params) {
  return http.post('/puppet-node/forward/stop', params)
}

export function stopAllLocalForwardsApi(params) {
  return http.post('/puppet-node/forward/stop-all', params)
}

export function listLocalForwardsApi(params) {
  return http.post('/puppet-node/forward/list', params)
}

// ── 反向隧道 ────────────────────────────────────────────────

export function startReverseTunnelApi(params) {
  return http.post('/puppet-node/reverse-tunnel/start', params)
}

export function stopReverseTunnelApi(params) {
  return http.post('/puppet-node/reverse-tunnel/stop', params)
}

export function stopAllReverseTunnelsApi(params) {
  return http.post('/puppet-node/reverse-tunnel/stop-all', params)
}

export function listReverseTunnelsApi(params) {
  return http.post('/puppet-node/reverse-tunnel/list', params)
}

export function invokePluginApi(params) {
  return http.post('/puppet-node/plugin/invoke', params)
}

// ── 临时脚本执行（不持久化为插件） ─────────────────────────────
// 与插件调用互补：插件 = 已保存的脚本/字节码；execScript = 即写即执行
export function execScriptApi(params) {
  return http.post('/puppet-node/exec-script', params)
}

// 临时 Java 字节码执行：上传 .class（base64）+ 入参，不持久化为插件
export function execClassApi(params) {
  return http.post('/puppet-node/exec-class', params)
}
