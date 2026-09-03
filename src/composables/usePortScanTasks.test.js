import { effectScope, nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  startNetworkProbeApi: vi.fn(),
  queryNetworkProbeApi: vi.fn(),
  pauseNetworkProbeApi: vi.fn(),
  resumeNetworkProbeApi: vi.fn(),
  stopNetworkProbeApi: vi.fn(),
  createScanTask: vi.fn(() => 'center-1'),
  hydrateScanTask: vi.fn(),
  showError: vi.fn(),
  showInfo: vi.fn(),
  showSuccess: vi.fn(),
  showWarning: vi.fn()
}))

vi.mock('@/services/api.js', () => ({
  startNetworkProbeApi: mocks.startNetworkProbeApi,
  queryNetworkProbeApi: mocks.queryNetworkProbeApi,
  pauseNetworkProbeApi: mocks.pauseNetworkProbeApi,
  resumeNetworkProbeApi: mocks.resumeNetworkProbeApi,
  stopNetworkProbeApi: mocks.stopNetworkProbeApi
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
    mocks.startNetworkProbeApi.mockResolvedValue({ data: { taskId: 'task-1' } })
    mocks.queryNetworkProbeApi.mockResolvedValue({
      data: {
        result: {
          status: 'STOPPED',
          total: 2,
          completed: 2,
          targets: [
            { host: 'host', port: 80, protocol: 'tcp' },
            { host: 'host', port: 443, protocol: 'tcp' }
          ],
          observations: [
            { host: 'host', port: 443, stage: 'tcp-connect', state: 'open' }
          ],
          plan: { stages: ['tcp-connect', 'tcp-exchange'], timeout: 1000, threads: 4 }
        }
      }
    })
    mocks.pauseNetworkProbeApi.mockResolvedValue({})
    mocks.resumeNetworkProbeApi.mockResolvedValue({})
    mocks.stopNetworkProbeApi.mockResolvedValue({})
  })

  it('starts, polls and maps the port scan response shape', async () => {
    const { scope, subject } = createSubject()
    await subject.start({ scanHost: 'host', scanPorts: [80, 443], scanTimeout: 1000, threadsNum: 4 })

    expect(mocks.startNetworkProbeApi).toHaveBeenCalledWith({
      sessionId: 'session-1',
      plan: {
        targets: [
          { protocol: 'tcp', host: 'host', port: 80 },
          { protocol: 'tcp', host: 'host', port: 443 }
        ],
        stages: ['tcp-connect', 'tcp-exchange'],
        limits: { timeout: 1000, threads: 4 }
      }
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
    mocks.startNetworkProbeApi.mockImplementationOnce(() => new Promise(resolve => { resolveStart = resolve }))
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

  it('creates one unified task for a batch of hosts', async () => {
    mocks.queryNetworkProbeApi.mockResolvedValue({
      data: {
        result: {
          status: 'RUNNING',
          total: 2,
          completed: 0,
          targets: [
            { host: 'host-a', port: 80, protocol: 'tcp' },
            { host: 'host-b', port: 80, protocol: 'tcp' }
          ],
          observations: [],
          plan: { stages: ['tcp-connect', 'tcp-exchange'], timeout: 1000, threads: 4 }
        }
      }
    })
    const { scope, subject } = createSubject()
    const result = await subject.startBatch({
      hosts: ['host-a', 'host-b', 'host-a'],
      scanPorts: [80],
      scanTimeout: 1000,
      threadsNum: 4
    })

    expect(result).toMatchObject({ successCount: 2, failCount: 0, taskCount: 1 })
    expect(mocks.startNetworkProbeApi).toHaveBeenCalledWith({
      sessionId: 'session-1',
      plan: {
        targets: [
          { protocol: 'tcp', host: 'host-a', port: 80 },
          { protocol: 'tcp', host: 'host-b', port: 80 }
        ],
        stages: ['tcp-connect', 'tcp-exchange'],
        limits: { timeout: 1000, threads: 4 }
      }
    })
    expect(subject.tasks.value[0].scanHost).toBe('host-a, host-b')
    scope.stop()
  })

})
