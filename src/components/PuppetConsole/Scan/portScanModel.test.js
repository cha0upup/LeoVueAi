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

  it('creates a discovery task with the unified target contract', () => {
    const task = createPortScanTaskModel({
      taskId: 'task-1',
      scanHost: '127.0.0.1',
      scanPorts: [80, 443],
      scanTimeout: 1000,
      threadsNum: 4
    })

    expect(task).toMatchObject({
      resultVersion: 1,
      scanKind: 'discovery',
      scanStage: 'PORT_AND_SERVICE',
      target: { host: '127.0.0.1', protocol: 'tcp', source: 'port-scan' },
      probeServices: true,
      serviceResults: []
    })

    expect(task.scanHosts).toEqual(['127.0.0.1'])
  })

  it('maps structured service results while retaining open port compatibility', () => {
    const task = createPortScanTaskModel({
      taskId: 'task-1',
      scanHost: '127.0.0.1',
      scanPorts: [80]
    })
    applyPortScanResult(task, {
      status: 'STOPPED',
      portLength: 1,
      scannedCount: 1,
      openPortList: [80],
      serviceResults: [{ host: '127.0.0.1', port: 80, service: 'http', statusCode: 200 }]
    })

    expect(task.openPortList).toEqual([80])
    expect(task.serviceResults).toEqual([
      { host: '127.0.0.1', port: 80, service: 'http', statusCode: 200 }
    ])
    expect(task.progress).toBe(100)
  })

  it('maps target-aware open port results for a unified multi-target task', () => {
    const task = createPortScanTaskModel({
      taskId: 'task-1',
      scanHost: '127.0.0.1',
      scanPorts: [80]
    })
    applyPortScanResult(task, {
      status: 'STOPPED',
      targetCount: 2,
      targets: [
        { host: '127.0.0.1', protocol: 'tcp' },
        { host: 'localhost', protocol: 'tcp' }
      ],
      portLength: 2,
      scannedCount: 2,
      openPortList: [80, 80],
      openPortResults: [
        { host: '127.0.0.1', port: 80, service: 'http' },
        { host: 'localhost', port: 80, service: 'http' }
      ]
    })

    expect(task.scanHost).toBe('127.0.0.1, localhost')
    expect(task.targetCount).toBe(2)
    expect(task.openPortResults).toHaveLength(2)
    expect(getPortScanTaskStats(task).openCount).toBe(2)
  })
})
