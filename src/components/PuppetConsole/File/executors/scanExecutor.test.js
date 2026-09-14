import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TaskStatus, TaskType } from '@/constants/task.js'

vi.mock('@/services/api.js', () => ({
  pauseNetworkProbeWorkflowApi: vi.fn(),
  resumeNetworkProbeWorkflowApi: vi.fn(),
  stopNetworkProbeWorkflowApi: vi.fn(),
  queryNetworkProbeWorkflowApi: vi.fn(),
  listNetworkProbeWorkflowTasksApi: vi.fn()
}))

import { normalizeNetworkWorkflowKind } from '../taskFactories.js'
import { applyScanExecutor } from './scanExecutor.js'

describe('normalizeNetworkWorkflowKind', () => {
  it('maps the legacy hyphenated value to the task engine identifier', () => {
    expect(normalizeNetworkWorkflowKind('network-workflow')).toBe('network_workflow')
    expect(normalizeNetworkWorkflowKind('NETWORK-WORKFLOW')).toBe('network_workflow')
  })

  it('leaves the canonical and unrelated values unchanged', () => {
    expect(normalizeNetworkWorkflowKind('network_workflow')).toBe('network_workflow')
    expect(normalizeNetworkWorkflowKind('other')).toBe('other')
    expect(normalizeNetworkWorkflowKind(null)).toBe(null)
  })
})

describe('scan executor task hydration', () => {
  beforeEach(() => vi.clearAllMocks())

  it('keeps a task visible when a legacy snapshot uses a hyphenated kind', () => {
    const task = {
      id: 'local-task',
      type: TaskType.SCAN,
      scanKind: 'network_workflow',
      status: TaskStatus.SCANNING,
      progress: 10,
      totalCount: 1,
      processedCount: 0
    }
    const events = []
    class FakeTaskEngine {
      getTaskById(taskId) { return taskId === task.id ? task : null }
      emit(...event) { events.push(event) }
    }
    applyScanExecutor(FakeTaskEngine)

    const engine = new FakeTaskEngine()
    engine.hydrateScanTask(task.id, {
      taskId: 'backend-task',
      scanKind: 'network-workflow',
      status: 'RUNNING',
      progress: 30
    })

    expect(task.scanKind).toBe('network_workflow')
    expect(task.backendTaskId).toBe('backend-task')
    expect(task.status).toBe(TaskStatus.SCANNING)
    expect(events.at(-1)?.[0]).toBe('taskProgress')
  })

  it('clears the current stage and completes target progress from a durable terminal snapshot', () => {
    const task = {
      id: 'local-task',
      type: TaskType.SCAN,
      scanKind: 'network_workflow',
      status: TaskStatus.SCANNING,
      currentStage: 'REACHABILITY',
      progress: 87,
      targetCount: 1,
      processedCount: 0
    }
    class FakeTaskEngine {
      getTaskById(taskId) { return taskId === task.id ? task : null }
      emit() {}
    }
    applyScanExecutor(FakeTaskEngine)

    const engine = new FakeTaskEngine()
    engine.hydrateScanTask(task.id, {
      taskId: 'backend-task',
      scanKind: 'network_workflow',
      status: 'STOPPED',
      outcome: 'COMPLETED',
      currentStage: null,
      progress: 100,
      targetCount: 1
    })

    expect(task.status).toBe(TaskStatus.COMPLETED)
    expect(task.currentStage).toBeNull()
    expect(task.processedCount).toBe(1)
  })
})
