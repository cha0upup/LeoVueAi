import { describe, expect, it } from 'vitest'

import {
  formatDatabaseError,
  getDatabaseErrorPayload,
  isRetryableDatabaseError
} from './databaseError.js'

describe('database errors', () => {
  it('turns runtime categories into actionable messages while retaining details', () => {
    const error = {
      response: {
        data: {
          code: 504,
          msg: 'statement exceeded 30 seconds',
          errorCategory: 'QUERY_TIMEOUT',
          sqlState: 'HYT00',
          retryable: true
        }
      }
    }

    expect(formatDatabaseError(error)).toBe(
      '数据库查询超时，请缩小查询范围或调整超时设置：statement exceeded 30 seconds（SQLState: HYT00）'
    )
    expect(isRetryableDatabaseError(error)).toBe(true)
    expect(getDatabaseErrorPayload(error).code).toBe(504)
  })

  it('uses backend detail and then the caller fallback for unclassified errors', () => {
    expect(formatDatabaseError({ message: 'socket closed' }, '加载失败')).toBe('socket closed')
    expect(formatDatabaseError({}, '加载失败')).toBe('加载失败')
  })
})
