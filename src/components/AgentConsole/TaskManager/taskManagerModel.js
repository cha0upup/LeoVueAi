import { ACTIVE_TASK_STATUSES, TASK_STATUS_TEXT, TaskStatus, TaskType } from '@/constants/task.js'

const TASK_TYPE_META = {
  [TaskType.DOWNLOAD]: { label: '下载任务', actionLabel: '下载', icon: 'download', runningStatus: TaskStatus.DOWNLOADING },
  [TaskType.UPLOAD]: { label: '上传任务', actionLabel: '上传', icon: 'upload', runningStatus: TaskStatus.UPLOADING },
  [TaskType.DB_EXPORT]: { label: '数据库导出', actionLabel: '导出', icon: 'database', runningStatus: TaskStatus.DB_EXPORTING },
  [TaskType.SCAN]: { label: '扫描任务', actionLabel: '扫描', icon: 'scan', runningStatus: TaskStatus.SCANNING }
}

const STATUS_BY_ENGINE_STATE = {
  PAUSED: TaskStatus.PAUSED,
  CANCELLED: TaskStatus.CANCELLED,
  FAILED: TaskStatus.FAILED,
  COMPLETED: TaskStatus.COMPLETED
}

const normalizeStatus = (value, runningStatus) => {
  const state = String(value || '').toUpperCase()
  return state === 'RUNNING' ? runningStatus : STATUS_BY_ENGINE_STATE[state] || TaskStatus.PENDING
}

const basename = (path) => {
  const normalized = String(path || '').replace(/\\/g, '/')
  const index = normalized.lastIndexOf('/')
  return index >= 0 ? normalized.slice(index + 1) : normalized
}

export const getDownloadRelativePath = (downloadPath) => {
  if (!downloadPath) return null
  const normalized = String(downloadPath).replace(/\\/g, '/')
  return normalized.startsWith('downloads/') ? normalized : null
}

export const normalizeServerDownloadTask = (snapshot = {}) => {
  const expectedLength = Number(snapshot.expectedLength || 0)
  const downloadedBytes = Number(snapshot.downloadedBytes || 0)
  const mappedStatus = normalizeStatus(snapshot.state, TaskStatus.DOWNLOADING)

  return {
    viewId: `server:${snapshot.taskId || ''}`,
    taskId: null,
    serverTaskId: snapshot.taskId || '',
    type: TaskType.DOWNLOAD,
    status: mappedStatus,
    progress: expectedLength > 0 ? (downloadedBytes / expectedLength) * 100 : 0,
    fileSize: expectedLength,
    speed: Number(snapshot.speedBytesPerSec || 0),
    options: { concurrency: snapshot.threads },
    downloadPath: snapshot.downloadPath || null,
    taskTempPath: snapshot.taskTempPath || null,
    fileName: basename(snapshot.downloadPath || snapshot.filePath || snapshot.taskId) || '下载任务',
    sessionId: snapshot.sessionId,
    lastError: snapshot.lastError || null,
    error: snapshot.lastError || null,
    currentStage: snapshot.currentStage || null,
    errorStage: snapshot.errorStage || null,
    createdTime: snapshot.createAtMs || null,
    startTime: snapshot.startAtMs || null,
    endTime: snapshot.endAtMs || null,
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
    status: normalizeStatus(task.status, TaskStatus.DB_EXPORTING),
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

export const normalizeServerUploadTask = (snapshot) => {
  const task = snapshot || {}
  const fileSize = Number(task.fileSize || 0)
  const uploadedBytes = Number(task.uploadedBytes || 0)
  return {
    viewId: `upload:${task.taskId || ''}`,
    taskId: null,
    serverTaskId: task.taskId || '',
    type: TaskType.UPLOAD,
    status: normalizeStatus(task.state, TaskStatus.UPLOADING),
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
    sessionId: task.sessionId,
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

const mergeSnapshots = ({ localTasks, serverTasks, serverIdField }) => {
  const localByServerId = new Map()
  for (const task of localTasks) {
    const serverTaskId = task[serverIdField]
    if (serverTaskId) localByServerId.set(serverTaskId, task)
  }
  const matchedLocalIds = new Set()

  const merged = serverTasks.map((serverTask) => {
    const localTask = localByServerId.get(serverTask.serverTaskId)
    if (!localTask) return serverTask
    matchedLocalIds.add(localTask.id)
    const local = prepareLocalTask(localTask, serverTask.serverTaskId)
    return {
      ...local,
      ...serverTask,
      viewId: local.viewId,
      taskId: local.taskId,
      serverTaskId: serverTask.serverTaskId || localTask[serverIdField] || null,
      fileName: serverTask.fileName || local.fileName,
      status: serverTask.status,
      isManagedLocally: true
    }
  })

  const unmatchedLocal = localTasks
    .filter((task) => !matchedLocalIds.has(task.id))
    .map((task) => prepareLocalTask(task, task[serverIdField]))

  return [...merged, ...unmatchedLocal]
}

export const buildTaskList = ({
  localTasks = [],
  serverDownloadTasks = [],
  serverUploadTasks = [],
  serverSqlExportTasks = []
} = {}) => {
  const groups = new Map([
    [TaskType.UPLOAD, { localTasks: [], serverTasks: serverUploadTasks, serverIdField: 'serverTaskId' }],
    [TaskType.DOWNLOAD, { localTasks: [], serverTasks: serverDownloadTasks, serverIdField: 'engineTaskId' }],
    [TaskType.DB_EXPORT, { localTasks: [], serverTasks: serverSqlExportTasks, serverIdField: 'serverTaskId' }]
  ])
  const otherTasks = []
  localTasks.forEach(task => {
    const group = groups.get(task.type)
    if (group) group.localTasks.push(task)
    else otherTasks.push(prepareLocalTask(task, task.serverTaskId || task.backendTaskId))
  })
  return [...otherTasks, ...[...groups.values()].flatMap(mergeSnapshots)]
}

export const getStatusText = (status) => TASK_STATUS_TEXT[status] || status || '-'

export const getIndicatorStatus = (status) => {
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

export const getProgressStatus = (status) => {
  if (status === TaskStatus.COMPLETED) return 'success'
  if (status === TaskStatus.FAILED) return 'exception'
  if (status === TaskStatus.PAUSED) return 'warning'
  return ''
}

export const getTaskTypeLabel = (type) => TASK_TYPE_META[type]?.label || '任务'

export const getScanKindLabel = (scanKind) =>
  ({
    network_workflow: '一键扫描'
  })[scanKind] || '扫描'

export const getTaskTypeIcon = (type, iconMap) => {
  const icon = TASK_TYPE_META[type]?.icon
  return (icon && iconMap[icon]) || iconMap.task
}

const isCommittingUpload = task => task.type === TaskType.UPLOAD &&
  task.currentStage === 'COMMITTING' && task.status === TaskStatus.UPLOADING

export const getPrimaryTaskAction = (task, iconMap) => {
  if (!task) return null
  if (isCommittingUpload(task)) return null
  const metadata = TASK_TYPE_META[task.type]
  const isTransfer = [TaskType.DOWNLOAD, TaskType.UPLOAD].includes(task.type)
  const canControl =
    (task.isManagedLocally && (task.type !== TaskType.SCAN || task.canControl !== false)) ||
    (isTransfer && task.serverTaskId)
  if (task.status === TaskStatus.FAILED && isTransfer && canControl) {
    return { key: 'retry', label: '重试', icon: 'mdi:refresh' }
  }
  if (
    task.status === TaskStatus.PENDING &&
    task.isManagedLocally &&
    ![TaskType.DB_EXPORT, TaskType.SCAN].includes(task.type)
  ) {
    return { key: 'start', label: '开始执行', icon: iconMap.play }
  }
  if (canControl && metadata?.actionLabel) {
    if (task.status === metadata.runningStatus && (task.type !== TaskType.UPLOAD || task.serverTaskId)) {
      return { key: 'pause', label: `暂停${metadata.actionLabel}`, icon: iconMap.videoPause }
    }
    if (task.status === TaskStatus.PAUSED) {
      return { key: 'resume', label: `继续${metadata.actionLabel}`, icon: iconMap.play }
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
    !isCommittingUpload(task) &&
    (task.isManagedLocally
      ? ACTIVE_TASK_STATUSES.includes(task.status) && task.canControl !== false
      : [TaskType.DOWNLOAD, TaskType.UPLOAD].includes(task.type) &&
        task.serverTaskId &&
        [TaskStatus.DOWNLOADING, TaskStatus.UPLOADING, TaskStatus.PAUSED, TaskStatus.PENDING]
          .includes(task.status))
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
