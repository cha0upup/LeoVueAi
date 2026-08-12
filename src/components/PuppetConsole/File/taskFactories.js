import { TaskStatus, TaskType } from '@/constants/task.js'

export function createDownloadTask({ taskId, sessionId, filePath, fileName, fileSize, options = {} }) {
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

const SCAN_KIND_LABELS = {
  host_reachability: '主机探活',
  port_scan: '端口扫描',
  fingerprint_scan: '指纹识别'
}

export function createScanTask({
  taskId,
  sessionId,
  scanKind,
  targetLabel,
  totalCount = 0,
  options = {}
}) {
  const kindLabel = SCAN_KIND_LABELS[scanKind] || '扫描任务'
  const createdTime = Date.now()

  return {
    id: taskId,
    type: TaskType.SCAN,
    sessionId,
    scanKind,
    targetLabel: targetLabel || '',
    fileName: options.fileName || `${kindLabel} · ${targetLabel || '未命名目标'}`,
    fileSize: 0,
    backendTaskId: options.backendTaskId || null,
    serverTaskId: options.backendTaskId || null,
    status: TaskStatus.PENDING,
    progress: 0,
    currentStep: '',
    totalCount: Number(totalCount || 0),
    processedCount: 0,
    targetCount: Number(options.targetCount ?? totalCount ?? 0),
    hitCount: 0,
    missCount: 0,
    resultSummary: '',
    scanHost: options.scanHost || '',
    scanHosts: options.scanHosts || [],
    scanPorts: options.scanPorts || [],
    portLength: Number(options.portLength ?? totalCount ?? 0),
    scannedCount: 0,
    openPortList: [],
    reachableHostList: [],
    unreachableHostList: [],
    fingerprintId: options.fingerprintId || '',
    protocol: options.protocol || '',
    result: null,
    createdTime,
    createTime: createdTime,
    startTime: null,
    endTime: null,
    isPaused: false,
    isCancelled: false,
    canControl: options.canControl !== false,
    error: null,
    options: {
      background: options.background !== false,
      ...options
    }
  }
}
