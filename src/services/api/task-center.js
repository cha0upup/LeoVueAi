import http from '../http.js'

/** 获取当前用户可见的跨会话任务快照。 */
export function globalTaskCenterSnapshotApi() {
  return http.get('/platform/task-center/snapshot')
}

/** 从全局任务中心停止可控的服务端任务。 */
export function globalTaskCenterCancelApi(params) {
  return http.post('/platform/task-center/cancel', params)
}
