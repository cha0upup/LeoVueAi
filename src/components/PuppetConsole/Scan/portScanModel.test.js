import { describe, expect, it, vi } from 'vitest'
import {
  applyPortScanResult,
  countActiveScanTasks,
  createPortScanTaskModel,
  getPortScanTaskStats,
  mergeScanTasks,
  normalizeHostReachabilityResult
} from './portScanModel.js'

describe('portScanModel', () => {
  it('creates a stable task model and applies bounded progress', () => {
    vi.spyOn(Date, 'now').mockReturnValue(500)
    const task = createPortScanTaskModel({ taskId: 'task-1', scanHost: 'host', scanPorts: [80, 443] })
    applyPortScanResult(task, { status: 'STOPPED', portLength: 2, scannedCount: 9, openPortList: [443] })
    task.status = 'STOPPED'
    applyPortScanResult(task, { portLength: 2, scannedCount: 9, openPortList: [443] })

    expect(task).toMatchObject({ portLength: 2, scannedCount: 2, progress: 100, endTime: 500 })
    expect(getPortScanTaskStats(task)).toEqual({
      portLength: 2,
      scannedCount: 2,
      openCount: 1,
      missCount: 1,
      completed: true
    })
    vi.restoreAllMocks()
  })

  it('merges task kinds by descending creation time', () => {
    const tasks = mergeScanTasks({
      port: [{ taskId: 'port', createTime: 1 }],
      tcp: [{ taskId: 'tcp', createTime: 3 }],
      recon: [{ taskId: 'recon', createTime: 2 }]
    })
    expect(tasks.map(task => [task.taskId, task._kind])).toEqual([
      ['tcp', 'fingerprint_tcp'],
      ['recon', 'recon_scan'],
      ['port', 'port_scan']
    ])
    expect(countActiveScanTasks([{ status: 'RUNNING' }, { status: 'STOPPED' }, { status: 'PAUSED' }])).toBe(2)
  })

  it('normalizes partial host reachability responses', () => {
    expect(normalizeHostReachabilityResult({ reachableHostList: ['a'], reachableCount: 1 }, 3)).toEqual({
      reachableHostList: ['a'],
      unreachableHostList: [],
      totalCount: 3,
      reachableCount: 1,
      unreachableCount: 2
    })
  })
})
