import { describe, expect, it } from 'vitest'

import { createSafeStorage } from './browserStorage.js'

function createMemoryStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  }
}

describe('createSafeStorage', () => {
  it('reads, writes and removes string values', () => {
    const storage = createMemoryStorage()
    const safeStorage = createSafeStorage(() => storage)

    expect(safeStorage.getItem('missing', 'fallback')).toBe('fallback')
    expect(safeStorage.setItem('count', 3)).toBe(true)
    expect(safeStorage.getItem('count')).toBe('3')
    expect(safeStorage.removeItem('count')).toBe(true)
    expect(safeStorage.getItem('count')).toBeNull()
  })

  it('preserves saved JSON after a failed write and ignores corrupt or unexpected data', () => {
    const storage = createMemoryStorage()
    const safeStorage = createSafeStorage(() => storage)
    const saved = { tabs: ['home'] }
    const fallback = { tabs: [] }
    const hasTabs = (value) => Array.isArray(value?.tabs)

    expect(safeStorage.setJSON('state', saved)).toBe(true)
    const circular = {}
    circular.self = circular
    expect(safeStorage.setJSON('state', circular)).toBe(false)
    expect(safeStorage.getJSON('state', fallback, hasTabs)).toEqual(saved)

    for (const invalid of ['{broken', '[]']) {
      storage.setItem('state', invalid)
      expect(safeStorage.getJSON('state', fallback, hasTabs)).toEqual(fallback)
    }
  })

  it('contains provider and quota errors instead of leaking them into the app', () => {
    const unavailable = createSafeStorage(() => {
      throw new Error('Storage access denied')
    })
    expect(unavailable.getItem('key', 'fallback')).toBe('fallback')
    expect(unavailable.setItem('key', 'value')).toBe(false)

    const quotaLimited = createSafeStorage(() => ({
      setItem() { throw new Error('Storage quota exceeded') }
    }))
    expect(quotaLimited.setJSON('state', { large: true })).toBe(false)
  })
})
