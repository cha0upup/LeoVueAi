import { describe, expect, it } from 'vitest'

import {
  normalizeDatabaseQueryTimeout,
  formatDatabaseResultSize,
  getDatabaseTruncationMessage,
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

  it('formats result boundaries for display', () => {
    expect(formatDatabaseResultSize(1536)).toBe('1.5 KB')
    expect(getDatabaseTruncationMessage({
      truncationReason: 'MAX_RESULT_BYTES',
      resultBytes: 2 * 1024 * 1024
    })).toBe('结果达到传输大小上限，仅展示部分数据（已接收 2.0 MB）')
  })

  it('recognizes axios cancellation errors', () => {
    expect(isCanceledDatabaseRequest({ code: 'ERR_CANCELED' })).toBe(true)
    expect(isCanceledDatabaseRequest({ name: 'CanceledError' })).toBe(true)
    expect(isCanceledDatabaseRequest(new Error('failed'))).toBe(false)
  })
})
