import { describe, expect, it, vi } from 'vitest'
import {
  createSessionChangedError,
  isCurrentSession,
  registerSessionCleanup,
  resetSessionState,
  sessionGeneration
} from './sessionLifecycle.js'

describe('browser session lifecycle', () => {
  it('invalidates old work before running the registered cleanups', () => {
    const generation = sessionGeneration.value
    const cleanup = vi.fn(() => expect(isCurrentSession(generation)).toBe(false))
    const unregister = registerSessionCleanup(Symbol(), cleanup)
    resetSessionState()
    expect(sessionGeneration.value).toBe(generation + 1)
    expect(cleanup).toHaveBeenCalledOnce()
    unregister()
    resetSessionState()
    expect(cleanup).toHaveBeenCalledOnce()
  })

  it('keeps a replacement cleanup when the old module is disposed', () => {
    const oldCleanup = vi.fn()
    const nextCleanup = vi.fn()
    const disposeOld = registerSessionCleanup('hot-module', oldCleanup)
    const disposeNext = registerSessionCleanup('hot-module', nextCleanup)
    disposeOld()
    resetSessionState()
    expect(oldCleanup).not.toHaveBeenCalled()
    expect(nextCleanup).toHaveBeenCalledOnce()
    disposeNext()
  })

  it('finishes all cleanups even if one throws or attempts a nested reset', () => {
    const logger = vi.spyOn(console, 'error').mockImplementation(() => {})
    const cleanup = vi.fn()
    const first = registerSessionCleanup(Symbol(), () => {
      resetSessionState()
      throw new Error('cleanup failed')
    })
    const second = registerSessionCleanup(Symbol(), cleanup)
    const generation = sessionGeneration.value
    try {
      resetSessionState()
      expect(sessionGeneration.value).toBe(generation + 1)
      expect(cleanup).toHaveBeenCalledOnce()
      expect(logger).toHaveBeenCalledOnce()
    } finally {
      first()
      second()
      logger.mockRestore()
    }
  })

  it('exposes a recognizable local error for discarded responses', () => {
    expect(createSessionChangedError()).toMatchObject({
      name: 'SessionChangedError', code: 'SESSION_CHANGED'
    })
  })
})
