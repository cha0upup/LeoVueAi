export const TaskType = {
  DOWNLOAD: 'download',
  UPLOAD: 'upload',
  DB_EXPORT: 'db_export',
  SCAN: 'scan'
}

export const TaskStatus = {
  PENDING: 'pending',
  UPLOADING: 'uploading',
  DOWNLOADING: 'downloading',
  DB_EXPORTING: 'db_exporting',
  SCANNING: 'scanning',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
}

export const ACTIVE_TASK_STATUSES = [
  TaskStatus.PENDING,
  TaskStatus.UPLOADING,
  TaskStatus.DOWNLOADING,
  TaskStatus.DB_EXPORTING,
  TaskStatus.SCANNING
]

export const TERMINAL_TASK_STATUSES = [
  TaskStatus.COMPLETED,
  TaskStatus.FAILED,
  TaskStatus.CANCELLED
]

export const TASK_STATUS_TEXT = {
  [TaskStatus.PENDING]: '等待中',
  [TaskStatus.UPLOADING]: '上传中',
  [TaskStatus.DOWNLOADING]: '下载中',
  [TaskStatus.DB_EXPORTING]: '导出中',
  [TaskStatus.SCANNING]: '扫描中',
  [TaskStatus.PAUSED]: '已暂停',
  [TaskStatus.COMPLETED]: '已完成',
  [TaskStatus.FAILED]: '失败',
  [TaskStatus.CANCELLED]: '已取消'
}

export const TASK_STATUS_TONE = {
  [TaskStatus.PENDING]: 'info',
  [TaskStatus.UPLOADING]: 'warning',
  [TaskStatus.DOWNLOADING]: 'warning',
  [TaskStatus.DB_EXPORTING]: 'warning',
  [TaskStatus.SCANNING]: 'primary',
  [TaskStatus.PAUSED]: 'warning',
  [TaskStatus.COMPLETED]: 'success',
  [TaskStatus.FAILED]: 'danger',
  [TaskStatus.CANCELLED]: 'info'
}
