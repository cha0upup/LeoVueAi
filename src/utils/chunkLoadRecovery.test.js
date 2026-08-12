import { describe, expect, it, vi } from 'vitest'

import { installChunkLoadRecovery, isChunkLoadError } from './chunkLoadRecovery.js'

const createFixture = (storedTarget = null) => {
  const callbacks = {}
  const router = {
    onError: vi.fn((callback) => { callbacks.onError = callback }),
    afterEach: vi.fn((callback) => { callbacks.afterEach = callback })
  }
  const storage = {
    getItem: vi.fn(() => storedTarget),
    setItem: vi.fn(),
    removeItem: vi.fn()
  }
  const location = {
    pathname: '/main',
    search: '',
    hash: '',
    assign: vi.fn()
  }
  installChunkLoadRecovery(router, storage, location)
  return { callbacks, location, storage }
}

describe('chunk load recovery', () => {
  it('recognizes browser dynamic-import failures', () => {
    expect(isChunkLoadError(new Error('Failed to fetch dynamically imported module'))).toBe(true)
    expect(isChunkLoadError(new Error('ordinary API failure'))).toBe(false)
  })

  it('reloads the failed route once', () => {
    const { callbacks, location, storage } = createFixture()

    callbacks.onError(
      new Error('Failed to fetch dynamically imported module'),
      { fullPath: '/login?redirect=/main' }
    )

    expect(storage.setItem).toHaveBeenCalledWith(
      'leovue-chunk-reload-target',
      '/login?redirect=/main'
    )
    expect(location.assign).toHaveBeenCalledWith('/login?redirect=/main')
  })

  it('does not loop when the same route still cannot load', () => {
    const { callbacks, location } = createFixture('/login')

    callbacks.onError(new Error('Importing a module script failed'), { fullPath: '/login' })

    expect(location.assign).not.toHaveBeenCalled()
  })
})
