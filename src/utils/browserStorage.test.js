import { describe, expect, it, vi } from 'vitest'

import { createSafeStorage } from './browserStorage.js'

function createMemoryStorage() {
  const values = new Map()
  return {
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, value)),
    removeItem: vi.fn((key) => values.delete(key))
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

  it('validates JSON values and falls back for corrupt data', () => {
    const storage = createMemoryStorage()
    const safeStorage = createSafeStorage(() => storage)

    expect(safeStorage.setJSON('state', { tabs: ['home'] })).toBe(true)
    expect(safeStorage.getJSON('state', {}, (value) => Array.isArray(value.tabs))).toEqual({
      tabs: ['home']
    })

    storage.setItem('state', '{broken')
    expect(safeStorage.getJSON('state', { tabs: [] })).toEqual({ tabs: [] })

    storage.setItem('state', '[]')
    expect(safeStorage.getJSON('state', { tabs: [] }, (value) => !Array.isArray(value))).toEqual({
      tabs: []
    })
  })

  it('contains provider and quota errors instead of leaking them into the app', () => {
    const unavailable = createSafeStorage(() => {
      throw Object.assign(new Error('denied'), { name: 'SecurityError' })
    })
    expect(unavailable.getItem('key', 'fallback')).toBe('fallback')
    expect(unavailable.setItem('key', 'value')).toBe(false)

    const storage = createMemoryStorage()
    storage.setItem.mockImplementation(() => {
      throw Object.assign(new Error('full'), { name: 'QuotaExceededError' })
    })
    const quotaLimited = createSafeStorage(() => storage)
    expect(quotaLimited.setJSON('state', { large: true })).toBe(false)
  })

  it('handles circular JSON values', () => {
    const storage = createMemoryStorage()
    const safeStorage = createSafeStorage(() => storage)
    const circular = {}
    circular.self = circular

    expect(safeStorage.setJSON('state', circular)).toBe(false)
  })
})
