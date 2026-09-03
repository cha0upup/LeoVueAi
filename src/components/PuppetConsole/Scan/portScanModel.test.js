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
    const result = {
      status: 'STOPPED',
      total: 2,
      completed: 9,
      targets: [
        { host: 'host', port: 80, protocol: 'tcp' },
        { host: 'host', port: 443, protocol: 'tcp' }
      ],
      observations: [
        { host: 'host', port: 443, stage: 'tcp-connect', state: 'open' }
      ]
    }
    applyPortScanResult(task, result)
    task.status = 'STOPPED'
    applyPortScanResult(task, result)

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

  it('maps structured service evidence from the unified result', () => {
    const task = createPortScanTaskModel({
      taskId: 'task-1',
      scanHost: '127.0.0.1',
      scanPorts: [80]
    })
    applyPortScanResult(task, {
      status: 'STOPPED',
      total: 1,
      completed: 1,
      targets: [{ host: '127.0.0.1', port: 80, protocol: 'tcp' }],
      plan: { stages: ['tcp-connect', 'tcp-exchange'] },
      observations: [
        { host: '127.0.0.1', port: 80, stage: 'tcp-connect', state: 'open' },
        {
          host: '127.0.0.1',
          port: 80,
          stage: 'tcp-exchange',
          state: 'open',
          evidence: { statusCode: 200 }
        }
      ]
    })

    expect(task.openPortList).toEqual([80])
    expect(task.serviceResults[0]).toMatchObject({
      host: '127.0.0.1', port: 80, service: 'http', statusCode: 200
    })
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
      targets: [
        { host: '127.0.0.1', port: 80, protocol: 'tcp' },
        { host: 'localhost', port: 80, protocol: 'tcp' }
      ],
      total: 2,
      completed: 2,
      observations: [
        { host: '127.0.0.1', port: 80, stage: 'tcp-connect', state: 'open' },
        { host: 'localhost', port: 80, stage: 'tcp-connect', state: 'open' }
      ]
    })

    expect(task.scanHost).toBe('127.0.0.1, localhost')
    expect(task.targetCount).toBe(2)
    expect(task.openPortResults).toHaveLength(2)
    expect(getPortScanTaskStats(task).openCount).toBe(2)
  })

  it('maps network probe observations into discovery results', () => {
    const task = createPortScanTaskModel({ taskId: 'probe-1', scanHost: '127.0.0.1', scanPorts: [80, 443] })
    applyPortScanResult(task, {
      resultVersion: 1,
      scanKind: 'network-probe',
      status: 'STOPPED',
      total: 2,
      completed: 2,
      targets: [
        { target: '127.0.0.1:80', host: '127.0.0.1', port: 80, protocol: 'tcp' },
        { target: '127.0.0.1:443', host: '127.0.0.1', port: 443, protocol: 'tcp' }
      ],
      plan: { stages: ['tcp-connect', 'tcp-exchange'], timeout: 3000, threads: 4 },
      observations: [
        { host: '127.0.0.1', port: 80, stage: 'tcp-connect', state: 'open' },
        {
          host: '127.0.0.1',
          port: 80,
          stage: 'tcp-exchange',
          state: 'open',
          evidence: { statusCode: 200, server: 'leo-test' }
        }
      ]
    })

    expect(task).toMatchObject({
      scanKind: 'discovery',
      scanStage: 'PORT_AND_SERVICE',
      scanHost: '127.0.0.1',
      scanPorts: [80, 443],
      portLength: 2,
      scannedCount: 2,
      progress: 100
    })
    expect(task.openPortList).toEqual([80])
    expect(task.serviceResults[0]).toMatchObject({
      host: '127.0.0.1',
      port: 80,
      service: 'http',
      statusCode: 200,
      server: 'leo-test',
      probe: 'tcp-exchange'
    })
  })
})
