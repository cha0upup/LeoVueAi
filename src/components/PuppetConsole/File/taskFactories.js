import { TaskStatus, TaskType } from '@/constants/task.js'

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
    totalChunks: 0,
    completedChunksCount: 0,
    failedChunksCount: 0,
    chunks: [],
    activeDownloads: new Set(),
    isPaused: false,
    isCancelled: false,
    retryCount: 0,
    error: null,
    options: {
      chunkSize: options.chunkSize || 524288,
      concurrency: options.concurrency || 5,
      maxRetries: options.maxRetries || 3,
      background: options.background !== false,
      ...options
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
    chunks: [],
    activeUploads: new Set(),
    isPaused: false,
    isCancelled: false,
    retryCount: 0,
    error: null,
    options: {
      chunkSize: options.chunkSize || 524288,
      concurrency: options.concurrency || 3,
      maxRetries: options.maxRetries || 3,
      background: options.background !== false,
      ...options
    }
  }
}

export function createDbExportTask({ taskId, sessionId, databaseName, tableCount, options = {} }) {
  return {
    id: taskId,
    type: TaskType.DB_EXPORT,
    sessionId,
    databaseName,
    tableCount,
    fileName: `${databaseName}_数据库导出_${new Date().toISOString().slice(0, 10)}.zip`,
    fileSize: 0,
    serverTaskId: null,
    connection: options.connection || null,
    downloadPath: null,
    status: TaskStatus.PENDING,
    progress: 0,
    currentTable: '',
    processedTables: 0,
    rowCount: null,
    createdTime: null,
    startTime: null,
    endTime: null,
    isPaused: false,
    isCancelled: false,
    retryCount: 0,
    error: null,
    result: null,
    options: {
      exportFormat: options.exportFormat || 'zip',
      includeData: options.includeData !== false,
      includeStructure: options.includeStructure !== false,
      background: options.background !== false,
      ...options
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
    reachabilityLoaded: false,
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
