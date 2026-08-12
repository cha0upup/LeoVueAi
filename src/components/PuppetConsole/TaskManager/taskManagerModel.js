import { ACTIVE_TASK_STATUSES, TASK_STATUS_TEXT, TaskStatus, TaskType } from '@/constants/task.js'

const STATUS_BY_ENGINE_STATE = {
  NEW: TaskStatus.PENDING,
  RUNNING: TaskStatus.DOWNLOADING,
  PAUSED: TaskStatus.PAUSED,
  CANCELLED: TaskStatus.CANCELLED,
  FAILED: TaskStatus.FAILED,
  COMPLETED: TaskStatus.COMPLETED
}

const STATUS_BY_SQL_STATE = {
  PENDING: TaskStatus.PENDING,
  RUNNING: TaskStatus.DB_EXPORTING,
  PAUSED: TaskStatus.PAUSED,
  CANCELLED: TaskStatus.CANCELLED,
  FAILED: TaskStatus.FAILED,
  COMPLETED: TaskStatus.COMPLETED
}

const STATUS_BY_UPLOAD_ENGINE_STATE = {
  NEW: TaskStatus.PENDING,
  RUNNING: TaskStatus.UPLOADING,
  PAUSED: TaskStatus.PAUSED,
  CANCELLED: TaskStatus.CANCELLED,
  FAILED: TaskStatus.FAILED,
  COMPLETED: TaskStatus.COMPLETED
}

const normalizeStatus = (value, statusMap) => {
  return statusMap[String(value || '').toUpperCase()] || TaskStatus.PENDING
}

const basename = path => {
  const normalized = String(path || '').replace(/\\/g, '/')
  const index = normalized.lastIndexOf('/')
  return index >= 0 ? normalized.slice(index + 1) : normalized
}

export const getDownloadRelativePath = downloadPath => {
  if (!downloadPath) return null
  const normalized = String(downloadPath).replace(/\\/g, '/')
  return normalized.startsWith('downloads/') ? normalized : null
}

export const normalizeServerDownloadTask = (raw, fallbackSessionId = '') => {
  const snapshot = raw?.meta
    ? { taskId: raw.taskId, sessionId: raw.sessionId, state: raw.state, ...raw.meta }
    : raw || {}
  const expectedLength = Number(snapshot.expectedLength || 0)
  const downloadedBytes = Number(snapshot.downloadedBytes || 0)
  const mappedStatus = normalizeStatus(snapshot.state, STATUS_BY_ENGINE_STATE)
  const hasCompletePayload =
    Boolean(getDownloadRelativePath(snapshot.downloadPath)) &&
    expectedLength > 0 &&
    downloadedBytes >= expectedLength

  return {
    viewId: `server:${snapshot.taskId || ''}`,
    taskId: null,
    serverTaskId: snapshot.taskId || '',
    type: TaskType.DOWNLOAD,
    status: hasCompletePayload ? TaskStatus.COMPLETED : mappedStatus,
    progress: expectedLength > 0 ? (downloadedBytes / expectedLength) * 100 : 0,
    fileSize: expectedLength,
    speed: Number(snapshot.speedBytesPerSec || 0),
    options: { concurrency: snapshot.threads },
    downloadPath: snapshot.downloadPath || null,
    taskTempPath: snapshot.taskTempPath || null,
    fileName: basename(snapshot.downloadPath || snapshot.filePath || snapshot.taskId) || '下载任务',
    sessionId: snapshot.sessionId || fallbackSessionId,
    lastError: snapshot.lastError || null,
    error: snapshot.lastError || null,
    currentStage: snapshot.currentStage || null,
    errorStage: snapshot.errorStage || null,
    createdTime: snapshot.createAtMs || snapshot.createdTime || null,
    startTime: snapshot.startAtMs || snapshot.startTime || null,
    endTime: snapshot.endAtMs || snapshot.endTime || null,
    updatedAt: snapshot.updatedAtMs || null,
    isManagedLocally: false
  }
}

export const normalizeServerSqlExportTask = (snapshot, sessionId = '') => {
  const task = snapshot || {}
  return {
    viewId: `sql-export:${task.taskId || ''}`,
    taskId: null,
    serverTaskId: task.taskId || '',
    type: TaskType.DB_EXPORT,
    status: normalizeStatus(task.status, STATUS_BY_SQL_STATE),
    progress: Number(task.progress || 0),
    fileSize: Number(task.fileSize || 0),
    speed: 0,
    fileName: task.fileName || task.currentTable || task.database || '数据库导出任务',
    sessionId,
    databaseName: task.database || '',
    currentTable: task.currentTable || '',
    processedTables: Number(task.processedTables || 0),
    tableCount: Number(task.tableCount || 0),
    rowCount: Number(task.rowCount || 0),
    downloadPath: task.downloadPath || null,
    createdTime: task.createdTime || null,
    startTime: task.startTime || null,
    endTime: task.endTime || null,
    error: task.error || null,
    lastError: task.error || null,
    options: {
      exportFormat: task.format || 'zip',
      includeStructure: task.includeStructure,
      includeData: task.includeData
    },
    isManagedLocally: false
  }
}

export const normalizeServerUploadTask = (snapshot, fallbackSessionId = '') => {
  const task = snapshot || {}
  const fileSize = Number(task.fileSize || 0)
  const uploadedBytes = Number(task.uploadedBytes || 0)
  return {
    viewId: `upload:${task.taskId || ''}`,
    taskId: null,
    serverTaskId: task.taskId || '',
    type: TaskType.UPLOAD,
    status: normalizeStatus(task.state, STATUS_BY_UPLOAD_ENGINE_STATE),
    progress:
      task.progress !== undefined
        ? Number(task.progress || 0)
        : fileSize > 0
          ? (uploadedBytes / fileSize) * 100
          : 0,
    fileSize,
    uploadedSize: uploadedBytes,
    speed: Number(task.speedBytesPerSec || 0),
    fileName: task.fileName || basename(task.filePath) || '上传任务',
    filePath: task.filePath || '',
    sessionId: task.sessionId || fallbackSessionId,
    currentStage: task.currentStage || null,
    errorStage: task.errorStage || null,
    error: task.errorMessage || null,
    lastError: task.errorMessage || null,
    createdTime: task.createdAt || null,
    startTime: task.startedAt || null,
    endTime: task.endAt || null,
    updatedAt: task.updatedAt || null,
    isManagedLocally: false
  }
}

const prepareLocalTask = (task, serverTaskId) => ({
  ...task,
  viewId: task.id,
  taskId: task.id,
  serverTaskId: serverTaskId || null,
  isManagedLocally: true
})

const mergeSnapshots = ({ localTasks, serverTasks, getLocalServerId, preserveCompleted = false }) => {
  const localByServerId = new Map(
    localTasks
      .map(task => [getLocalServerId(task), task])
      .filter(([serverTaskId]) => Boolean(serverTaskId))
  )
  const matchedLocalIds = new Set()

  const merged = serverTasks.map(serverTask => {
    const localTask = localByServerId.get(serverTask.serverTaskId)
    if (!localTask) return serverTask
    matchedLocalIds.add(localTask.id)
    const local = prepareLocalTask(localTask, serverTask.serverTaskId)
    return {
      ...local,
      ...serverTask,
      viewId: local.viewId,
      taskId: local.taskId,
      serverTaskId: serverTask.serverTaskId || getLocalServerId(localTask) || null,
      fileName: serverTask.fileName || local.fileName,
      status:
        preserveCompleted && local.status === TaskStatus.COMPLETED
          ? TaskStatus.COMPLETED
          : serverTask.status,
      isManagedLocally: true
    }
  })

  const unmatchedLocal = localTasks
    .filter(task => !matchedLocalIds.has(task.id))
    .map(task => prepareLocalTask(task, getLocalServerId(task)))

  return [...merged, ...unmatchedLocal]
}

export const buildTaskList = ({
  localTasks = [],
  serverDownloadTasks = [],
  serverUploadTasks = [],
  serverSqlExportTasks = []
} = {}) => {
  const downloads = localTasks.filter(task => task.type === TaskType.DOWNLOAD)
  const uploads = localTasks.filter(task => task.type === TaskType.UPLOAD)
  const sqlExports = localTasks.filter(task => task.type === TaskType.DB_EXPORT)
  const otherTasks = localTasks
    .filter(
      task =>
        task.type !== 'shell' &&
        ![TaskType.DOWNLOAD, TaskType.UPLOAD, TaskType.DB_EXPORT].includes(task.type)
    )
    .map(task => prepareLocalTask(task, task.serverTaskId || task.backendTaskId))

  return [
    ...otherTasks,
    ...mergeSnapshots({
      localTasks: uploads,
      serverTasks: serverUploadTasks,
      getLocalServerId: task => task.serverTaskId
    }),
    ...mergeSnapshots({
      localTasks: downloads,
      serverTasks: serverDownloadTasks,
      getLocalServerId: task => task.engineTaskId,
      preserveCompleted: true
    }),
    ...mergeSnapshots({
      localTasks: sqlExports,
      serverTasks: serverSqlExportTasks,
      getLocalServerId: task => task.serverTaskId
    })
  ]
}

export const getStatusText = status => TASK_STATUS_TEXT[status] || status || '-'

export const getIndicatorStatus = status => {
  if (ACTIVE_TASK_STATUSES.includes(status)) {
    return status === TaskStatus.PENDING ? 'waiting' : 'running'
  }
  return (
    {
      [TaskStatus.PAUSED]: 'warning',
      [TaskStatus.COMPLETED]: 'success',
      [TaskStatus.FAILED]: 'failed',
      [TaskStatus.CANCELLED]: 'disabled'
    }[status] || 'untested'
  )
}

export const getProgressStatus = status => {
  if (status === TaskStatus.COMPLETED) return 'success'
  if (status === TaskStatus.FAILED) return 'exception'
  if (status === TaskStatus.PAUSED) return 'warning'
  return ''
}

export const getTaskTypeLabel = type =>
  ({
    [TaskType.DOWNLOAD]: '下载任务',
    [TaskType.UPLOAD]: '上传任务',
    [TaskType.DB_EXPORT]: '数据库导出',
    [TaskType.SCAN]: '扫描任务'
  })[type] || '任务'

export const getScanKindLabel = scanKind =>
  ({
    host_reachability: '主机探活',
    port_scan: '端口扫描',
    fingerprint_scan: '指纹识别'
  })[scanKind] || '扫描'

export const getTaskTypeIcon = (type, iconMap) =>
  ({
    [TaskType.DOWNLOAD]: iconMap.download,
    [TaskType.UPLOAD]: iconMap.upload,
    [TaskType.DB_EXPORT]: iconMap.database,
    [TaskType.SCAN]: iconMap.scan
  })[type] || iconMap.task

export const getPrimaryTaskAction = (task, iconMap) => {
  if (!task) return null
  if (
    task.status === TaskStatus.FAILED &&
    ((task.isManagedLocally && [TaskType.DOWNLOAD, TaskType.UPLOAD].includes(task.type)) ||
      ([TaskType.DOWNLOAD, TaskType.UPLOAD].includes(task.type) && task.serverTaskId))
  ) {
    return { key: 'retry', label: '重试', icon: 'mdi:refresh' }
  }
  if (
    task.type === TaskType.UPLOAD &&
    task.status === TaskStatus.UPLOADING &&
    task.serverTaskId
  ) {
    return { key: 'pause', label: '暂停上传', icon: iconMap.videoPause }
  }
  if (
    task.status === TaskStatus.PENDING &&
    task.isManagedLocally &&
    ![TaskType.DB_EXPORT, TaskType.SCAN].includes(task.type)
  ) {
    return { key: 'start', label: '开始执行', icon: iconMap.play }
  }
  if (
    task.type === TaskType.SCAN &&
    task.status === TaskStatus.SCANNING &&
    task.isManagedLocally &&
    task.canControl !== false
  ) {
    return { key: 'pause', label: '暂停扫描', icon: iconMap.videoPause }
  }
  if (
    task.type === TaskType.SCAN &&
    task.status === TaskStatus.PAUSED &&
    task.isManagedLocally &&
    task.canControl !== false
  ) {
    return { key: 'resume', label: '继续扫描', icon: iconMap.play }
  }
  if (
    task.type === TaskType.DOWNLOAD &&
    task.status === TaskStatus.DOWNLOADING &&
    (task.isManagedLocally || task.serverTaskId)
  ) {
    return { key: 'pause', label: '暂停下载', icon: iconMap.videoPause }
  }
  if (
    task.type === TaskType.DB_EXPORT &&
    task.status === TaskStatus.DB_EXPORTING &&
    task.isManagedLocally
  ) {
    return { key: 'pause', label: '暂停导出', icon: iconMap.videoPause }
  }
  if (
    [TaskType.DOWNLOAD, TaskType.UPLOAD, TaskType.DB_EXPORT].includes(task.type) &&
    task.status === TaskStatus.PAUSED &&
    (task.isManagedLocally ||
      ([TaskType.DOWNLOAD, TaskType.UPLOAD].includes(task.type) && task.serverTaskId))
  ) {
    return {
      key: 'resume',
      label:
        task.type === TaskType.DOWNLOAD
          ? '继续下载'
          : task.type === TaskType.UPLOAD
            ? '继续上传'
            : '继续导出',
      icon: iconMap.play
    }
  }
  if (
    [TaskType.DOWNLOAD, TaskType.DB_EXPORT].includes(task.type) &&
    task.status === TaskStatus.COMPLETED &&
    getDownloadRelativePath(task.downloadPath)
  ) {
    return { key: 'download', label: '下载到本地', icon: iconMap.download }
  }
  return null
}

export const getSecondaryTaskActions = (task, iconMap) => {
  if (!task) return []
  const actions = []
  if (
    ACTIVE_TASK_STATUSES.includes(task.status) &&
    task.isManagedLocally &&
    task.canControl !== false
  ) {
    actions.push({ key: 'stop', label: '停止', icon: iconMap.circleClose, type: 'warning' })
  }
  if (
    [TaskType.DOWNLOAD, TaskType.UPLOAD].includes(task.type) &&
    task.serverTaskId &&
    !task.isManagedLocally &&
    [
      TaskStatus.DOWNLOADING,
      TaskStatus.UPLOADING,
      TaskStatus.PAUSED,
      TaskStatus.PENDING
    ].includes(task.status)
  ) {
    actions.push({ key: 'stop', label: '停止', icon: iconMap.circleClose, type: 'warning' })
  }
  if (
    task.status === TaskStatus.COMPLETED &&
    [TaskType.DOWNLOAD, TaskType.DB_EXPORT].includes(task.type) &&
    !getDownloadRelativePath(task.downloadPath)
  ) {
    actions.push({
      key: 'download',
      label: '暂无文件',
      icon: iconMap.download,
      type: 'info',
      disabled: true
    })
  }
  actions.push({
    key: 'remove',
    label: '删除',
    icon: iconMap.delete,
    type: 'danger',
    disabled:
      ACTIVE_TASK_STATUSES.includes(task.status) ||
      (!task.taskId &&
        !([TaskType.DOWNLOAD, TaskType.UPLOAD].includes(task.type) && task.serverTaskId))
  })
  return actions
}
