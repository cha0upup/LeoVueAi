import { describe, expect, it } from 'vitest'

import {
  normalizeDatabaseQueryTimeout,
  isCanceledDatabaseRequest
} from './database-query-status.js'

describe('database query status', () => {
  it('normalizes query timeout values consistently', () => {
    expect(normalizeDatabaseQueryTimeout(45)).toBe(45)
    expect(normalizeDatabaseQueryTimeout('60')).toBe(60)
    expect(normalizeDatabaseQueryTimeout(0)).toBe(30)
    expect(normalizeDatabaseQueryTimeout(301)).toBe(30)
    expect(normalizeDatabaseQueryTimeout(1.5)).toBe(30)
  })

  it('recognizes axios cancellation errors', () => {
    expect(isCanceledDatabaseRequest({ code: 'ERR_CANCELED' })).toBe(true)
    expect(isCanceledDatabaseRequest({ name: 'CanceledError' })).toBe(true)
    expect(isCanceledDatabaseRequest(new Error('failed'))).toBe(false)
  })
})
