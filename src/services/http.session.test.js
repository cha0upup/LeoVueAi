import { afterEach, describe, expect, it, vi } from 'vitest'
import { deferred } from '@/test-support/deferred.js'
import { resetSessionState, sessionGeneration } from './sessionLifecycle.js'
import http from './http.js'

vi.hoisted(() => { globalThis.window = { location: { origin: 'http://localhost' } } })

const originalAdapter = http.defaults.adapter
afterEach(() => { http.defaults.adapter = originalAdapter })

describe('Axios login generation binding', () => {
  it('captures the identity synchronously before a login change', async () => {
    const response = deferred()
    const adapter = vi.fn(config => response.promise.then(data => ({
      config, status: 200, statusText: 'OK', headers: {}, data
    })))
    http.defaults.adapter = adapter
    const generation = sessionGeneration.value
    const request = http.get('/fixture')
    expect(adapter).toHaveBeenCalledOnce()
    expect(adapter.mock.calls[0][0].sessionGeneration).toBe(generation)
    resetSessionState()
    response.resolve({ code: 200, data: 'previous login data' })
    await expect(request).rejects.toMatchObject({ code: 'SESSION_CHANGED' })
  })
})
