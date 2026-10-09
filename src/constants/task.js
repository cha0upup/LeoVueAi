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

export const FILE_TRANSFER_CHUNK_OPTIONS = Object.freeze([
  { label: '64KB', value: 65536 },
  { label: '128KB', value: 131072 },
  { label: '256KB', value: 262144 },
  { label: '512KB', value: 524288 },
  { label: '1MB', value: 1048576 }
])
