import { normalizeEngineTaskStatus, TaskStatus, TaskType } from '@/constants/task.js'

export function createDownloadTask({
  taskId,
  sessionId,
  filePath,
  fileName,
  fileSize,
  options = {}
}) {
  return {
    id: taskId,
    type: TaskType.DOWNLOAD,
    sessionId,
    filePath,
    fileName,
    fileSize,
    status: TaskStatus.PENDING,
    progress: 0,
    downloadedSize: 0,
    startTime: null,
    endTime: null,
    speed: 0,
    engineTaskId: null,
    expectedMd5: null,
    downloadPath: null,
    taskTempPath: null,
    lastError: null,
    currentStage: 'CREATED',
    errorStage: null,
    isPaused: false,
    isCancelled: false,
    error: null,
    options: {
      chunkSize: options.chunkSize ?? 524288,
      concurrency: options.concurrency ?? 5,
    }
  }
}

export function createUploadTask({
  taskId,
  sessionId,
  serverPath,
  fileName,
  fileSize,
  fileData,
  options = {}
}) {
  return {
    id: taskId,
    type: TaskType.UPLOAD,
    sessionId,
    serverPath,
    fileName,
    fileSize,
    fileData,
    uploadPath: null,
    status: TaskStatus.PENDING,
    progress: 0,
    uploadedSize: 0,
    startTime: null,
    endTime: null,
    speed: 0,
    isPaused: false,
    isCancelled: false,
    error: null,
    options: {
      chunkSize: options.chunkSize ?? 524288,
      concurrency: options.concurrency ?? 3,
      maxRetries: options.maxRetries ?? 3,
    }
  }
}

export function createDbExportTask({ taskId, sessionId, snapshot, databaseName = '', connection }) {
  const database = snapshot.database || databaseName
  return {
    id: taskId,
    type: TaskType.DB_EXPORT,
    sessionId,
    databaseName: database,
    tableCount: snapshot.tableCount ?? (Array.isArray(snapshot.tableRefs) ? snapshot.tableRefs.length : 0),
    fileName: snapshot.fileName || `${database}_数据库导出_${new Date().toISOString().slice(0, 10)}.zip`,
    fileSize: snapshot.fileSize ?? 0,
    serverTaskId: snapshot.taskId,
    connection: connection || null,
    downloadPath: snapshot.downloadPath || null,
    status: normalizeEngineTaskStatus(snapshot.status, TaskStatus.DB_EXPORTING),
    progress: Number(snapshot.progress || 0),
    currentTable: snapshot.currentTable || '',
    processedTables: Number(snapshot.processedTables || 0),
    rowCount: snapshot.rowCount ?? null,
    createdTime: snapshot.createdTime || null,
    startTime: snapshot.startTime || null,
    endTime: snapshot.endTime || null,
    isPaused: false,
    isCancelled: false,
    error: snapshot.error || null,
    options: {
      exportFormat: snapshot.format || 'zip',
      includeData: snapshot.includeData ?? true,
      includeStructure: snapshot.includeStructure ?? true,
    }
  }
}

export function createScanTask({
  taskId,
  sessionId,
  targetLabel,
  options = {}
}) {
  return {
    id: taskId,
    type: TaskType.SCAN,
    sessionId,
    scanKind: 'network_workflow',
    targetLabel: targetLabel || '',
    fileName: `一键扫描 · ${targetLabel || '未命名目标'}`,
    fileSize: 0,
    backendTaskId: options.backendTaskId || null,
    status: TaskStatus.PENDING,
    progress: 0,
    processedCount: 0,
    targetCount: Number(options.targetCount ?? 0),
    openCount: 0,
    serviceCount: 0,
    fingerprintCount: 0,
    identifiedApplicationCount: 0,
    scanHosts: options.scanHosts || [],
    scanPorts: options.scanPorts || [],
    reachableHostList: [],
    reachableHostCount: 0,
    detailsLoaded: false,
    stages: [],
    currentStage: null,
    createdAt: Date.now(),
    startTime: null,
    endTime: null,
    isPaused: false,
    isCancelled: false,
    canControl: options.canControl !== false,
    error: null
  }
}
