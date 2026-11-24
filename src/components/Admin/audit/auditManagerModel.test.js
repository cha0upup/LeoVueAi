import { describe, expect, it } from 'vitest'

import {
  buildAuditFilterParams,
  createAuditFilter,
  formatAuditJson,
  formatAuditTime,
  getActiveAuditFilterSummary
} from './auditManagerModel.js'

describe('auditManagerModel', () => {
  it('builds trimmed filter parameters and a complete date range', () => {
    const filter = createAuditFilter()
    Object.assign(filter, {
      userId: ' user-1 ',
      keyword: ' command ',
      dateRange: ['2026-01-01 00:00:00', '2026-01-02 00:00:00']
    })

    expect(buildAuditFilterParams(filter)).toEqual({
      userId: 'user-1',
      keyword: 'command',
      startTime: '2026-01-01 00:00:00',
      endTime: '2026-01-02 00:00:00'
    })
  })

  it('creates filter labels from the submitted parameters only', () => {
    expect(getActiveAuditFilterSummary({
      operationType: 'FILE_READ', status: 'FAILED', startTime: '1', endTime: '2'
    })).toEqual([
      { field: 'operationType', label: '操作类型', value: '读取文件' },
      { field: 'status', label: '状态', value: '失败' },
      { field: 'dateRange', label: '时间范围', value: '1 ~ 2' }
    ])
  })

  it('does not treat whitespace-only values as an active deletion filter', () => {
    const filter = createAuditFilter()
    filter.keyword = '   '
    filter.userId = '\t'
    filter.dateRange = ['2026-01-01 00:00:00', '']

    expect(buildAuditFilterParams(filter)).toEqual({})
  })

  it('formats JSON and preserves malformed payloads', () => {
    expect(formatAuditJson('{"ok":true}')).toBe('{\n  "ok": true\n}')
    expect(formatAuditJson('{bad')).toBe('{bad')
    expect(formatAuditJson(null)).toBe('-')
  })

  it('preserves invalid timestamps instead of emitting invalid date text', () => {
    expect(formatAuditTime('not-a-date')).toBe('not-a-date')
    expect(formatAuditTime('')).toBe('-')
  })
})
