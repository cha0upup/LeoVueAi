import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useFingerprintDebug } from './useFingerprintDebug.js'
import { debugNetworkFingerprintApi, queryNetworkProbeWorkflowApi, stopNetworkProbeWorkflowApi } from '@/services/api.js'

vi.mock('@/services/api.js', () => ({
  debugNetworkFingerprintApi: vi.fn(),
  queryNetworkProbeWorkflowApi: vi.fn(),
  stopNetworkProbeWorkflowApi: vi.fn()
}))

describe('fingerprint debug task lifecycle', () => {
  let scope
  afterEach(() => { scope?.stop(); vi.resetAllMocks(); vi.useRealTimers() })
  function fixture() {
    vi.useFakeTimers()
    scope = effectScope()
    return scope.run(useFingerprintDebug)
  }
  const input = { sessionId: 'one', target: 'http://example.test/app/', fingerprint: { rule: { requests: [{}] } } }

  it('sends the draft without saving, polls once at a time and stops at completion', async () => {
    debugNetworkFingerprintApi.mockResolvedValue({ data: { taskId: 'debug' } })
    queryNetworkProbeWorkflowApi
      .mockResolvedValueOnce({ data: { status: 'RUNNING' } })
      .mockResolvedValueOnce({ data: { status: 'STOPPED', outcome: 'COMPLETED' } })
    const debug = fixture()
    await debug.start(input)
    expect(debugNetworkFingerprintApi).toHaveBeenCalledWith(input)
    expect(debug.active.value).toBe(true)
    await debug.start(input)
    expect(debugNetworkFingerprintApi).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1000)
    expect(debug.active.value).toBe(false)
    expect(debug.refreshToken.value).toBe(2)
    await vi.advanceTimersByTimeAsync(5000)
    expect(queryNetworkProbeWorkflowApi).toHaveBeenCalledTimes(2)
  })

  it('ignores a delayed start response after disposal', async () => {
    let resolve
    debugNetworkFingerprintApi.mockReturnValue(new Promise(done => { resolve = done }))
    const debug = fixture()
    const pending = debug.start(input)
    scope.stop()
    resolve({ data: { taskId: 'late' } })
    await pending
    expect(debug.taskId.value).toBe('')
    expect(queryNetworkProbeWorkflowApi).not.toHaveBeenCalled()
  })

  it('keeps the task available for retry and stop when polling fails', async () => {
    debugNetworkFingerprintApi.mockResolvedValue({ data: { taskId: 'debug' } })
    queryNetworkProbeWorkflowApi
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ data: { status: 'STOPPED', outcome: 'CANCELLED' } })
    stopNetworkProbeWorkflowApi.mockResolvedValue({ data: {} })
    const debug = fixture()
    await debug.start(input)
    expect(debug.error.value).toBe('offline')
    expect(debug.active.value).toBe(true)
    await debug.stop()
    expect(stopNetworkProbeWorkflowApi).toHaveBeenCalledWith({ sessionId: 'one', taskId: 'debug' })
    expect(debug.error.value).toBe('')
    expect(debug.summary.value.outcome).toBe('CANCELLED')
  })
})
