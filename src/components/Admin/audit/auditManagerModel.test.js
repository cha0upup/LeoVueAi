import { describe, expect, it } from 'vitest'

import {
  buildAuditFilterParams,
  createAuditFilter,
  formatAuditJson,
  getActiveAuditFilterSummary
} from './auditManagerModel.js'

describe('auditManagerModel', () => {
  it('submits trimmed filter values and displays the submitted range and status', () => {
    const filter = createAuditFilter()
    const dateRange = ['2026-01-01 00:00:00', '2026-01-02 00:00:00']
    Object.assign(filter, {
      userId: ' user-1 ',
      status: 'FAILED',
      dateRange
    })

    const params = buildAuditFilterParams(filter)
    expect(params).toEqual({
      userId: 'user-1', status: 'FAILED', startTime: dateRange[0], endTime: dateRange[1]
    })
    expect(getActiveAuditFilterSummary(params)).toEqual([
      { field: 'userId', label: '用户ID', value: 'user-1' },
      { field: 'status', label: '状态', value: '失败' },
      { field: 'dateRange', label: '时间范围', value: '2026-01-01 00:00:00 ~ 2026-01-02 00:00:00' }
    ])
  })

  it('does not treat an incomplete date range as a deletion filter', () => {
    expect(buildAuditFilterParams({ dateRange: ['2026-01-01 00:00:00', ''] })).toEqual({})
  })

  it('formats JSON and preserves malformed payloads', () => {
    expect(formatAuditJson('{"ok":true}')).toBe('{\n  "ok": true\n}')
    expect(formatAuditJson('{bad')).toBe('{bad')
    expect(formatAuditJson(null)).toBe('-')
  })
})
