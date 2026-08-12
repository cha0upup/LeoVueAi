import http from '../http.js'

export function listEventLogSourcesApi(params) {
  return http.post('/puppet-node/event-log/list-sources', params)
}

export function queryEventLogApi(params) {
  return http.post('/puppet-node/event-log/query', params)
}

export function getEventLogStatsApi(params) {
  return http.post('/puppet-node/event-log/stats', params)
}

export function aggregateEventLogApi(params) {
  return http.post('/puppet-node/event-log/aggregate', params)
}

export function metaEventLogApi(params) {
  return http.post('/puppet-node/event-log/meta', params)
}

/**
 * 实时跟随(SSE)。返回 EventSource 实例,调用方负责 .close()。
 * 自动从 http.defaults.baseURL 取基地址。
 * params: { sessionId, source, format?, intervalMs? }
 */
export function followEventLogSse(params) {
  const base = http.defaults.baseURL || ''
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) qs.append(k, String(v))
  })
  const url = `${base}/puppet-node/event-log/follow?${qs.toString()}`
  return new EventSource(url, { withCredentials: true })
}
