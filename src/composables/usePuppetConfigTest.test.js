import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ testConfig: vi.fn(), showError: vi.fn() }))

vi.mock('@/services/api.js', () => ({ testPuppetConfigApi: mocks.testConfig }))
vi.mock('@/utils/messageUtils.js', () => ({ showError: mocks.showError }))

import { usePuppetConfigTest } from './usePuppetConfigTest.js'

describe('usePuppetConfigTest', () => {
  it('tests the current unsaved payload and exposes the result', async () => {
    mocks.testConfig.mockResolvedValue({ data: { success: true, latencyMs: 12 } })
    const payload = { connLink: 'https://host.test' }
    const tester = usePuppetConfigTest({
      validate: vi.fn().mockResolvedValue(true),
      buildPayload: () => payload
    })

    await tester.testConnection()

    expect(mocks.testConfig).toHaveBeenCalledWith(payload)
    expect(tester.result.value).toEqual({ success: true, latencyMs: 12 })
    expect(tester.testing.value).toBe(false)
  })

  it('stops before the request when form validation fails', async () => {
    mocks.testConfig.mockClear()
    const tester = usePuppetConfigTest({
      validate: vi.fn().mockResolvedValue(false),
      buildPayload: vi.fn()
    })

    await tester.testConnection()

    expect(mocks.testConfig).not.toHaveBeenCalled()
    expect(tester.result.value).toBeNull()
  })
})
