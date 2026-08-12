import { effectScope, nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  startPortScanApi: vi.fn(),
  queryPortScanResultApi: vi.fn(),
  pausePortScanApi: vi.fn(),
  resumePortScanApi: vi.fn(),
  stopPortScanApi: vi.fn(),
  createScanTask: vi.fn(() => 'center-1'),
  hydrateScanTask: vi.fn(),
  showError: vi.fn(),
  showInfo: vi.fn(),
  showSuccess: vi.fn(),
  showWarning: vi.fn()
}))

vi.mock('@/services/api.js', () => ({
  startPortScanApi: mocks.startPortScanApi,
  queryPortScanResultApi: mocks.queryPortScanResultApi,
  pausePortScanApi: mocks.pausePortScanApi,
  resumePortScanApi: mocks.resumePortScanApi,
  stopPortScanApi: mocks.stopPortScanApi
}))

vi.mock('@/components/PuppetConsole/File/TaskEngine.js', () => ({
  taskEngine: {
    createScanTask: mocks.createScanTask,
    hydrateScanTask: mocks.hydrateScanTask
  }
}))

vi.mock('@/utils/messageUtils.js', () => ({
  showError: mocks.showError,
  showInfo: mocks.showInfo,
  showSuccess: mocks.showSuccess,
  showWarning: mocks.showWarning
}))

import { usePortScanTasks } from './usePortScanTasks.js'

const createSubject = () => {
  const scope = effectScope()
  const sessionId = ref('session-1')
  let subject
  scope.run(() => { subject = usePortScanTasks(sessionId) })
  return { scope, sessionId, subject }
}

describe('usePortScanTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.startPortScanApi.mockResolvedValue({ data: { taskId: 'task-1' } })
    mocks.queryPortScanResultApi.mockResolvedValue({
      data: {
        scanTaskInfo: {
          status: 'STOPPED',
          portLength: 2,
          scannedCount: 2,
          openPortList: [443]
        }
      }
    })
    mocks.pausePortScanApi.mockResolvedValue({})
    mocks.resumePortScanApi.mockResolvedValue({})
    mocks.stopPortScanApi.mockResolvedValue({})
  })

  it('starts, polls and maps the port scan response shape', async () => {
    const { scope, subject } = createSubject()
    await subject.start({ scanHost: 'host', scanPorts: [80, 443], scanTimeout: 1000, threadsNum: 4 })

    expect(mocks.startPortScanApi).toHaveBeenCalledWith({
      sessionId: 'session-1',
      scanHost: 'host',
      scanPorts: [80, 443],
      scanTimeout: 1000,
      threadsNum: 4
    })
    expect(subject.tasks.value[0]).toMatchObject({
      taskId: 'task-1',
      status: 'STOPPED',
      progress: 100,
      openPortList: [443]
    })
    expect(mocks.hydrateScanTask).toHaveBeenLastCalledWith('center-1', expect.objectContaining({
      hitCount: 1,
      processedCount: 2,
      totalCount: 2
    }))
    scope.stop()
  })

  it('drops a late start response when the session changes', async () => {
    let resolveStart
    mocks.startPortScanApi.mockImplementationOnce(() => new Promise(resolve => { resolveStart = resolve }))
    const { scope, sessionId, subject } = createSubject()

    const starting = subject.start({ scanHost: 'old', scanPorts: [80] })
    sessionId.value = 'session-2'
    await nextTick()
    resolveStart({ data: { taskId: 'old-task' } })
    await starting

    expect(subject.tasks.value).toHaveLength(0)
    expect(subject.isStarting.value).toBe(false)
    expect(mocks.createScanTask).not.toHaveBeenCalled()
    scope.stop()
  })
})
