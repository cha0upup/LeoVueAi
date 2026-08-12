import { describe, expect, it } from 'vitest'

import {
  buildAuditFilterParams,
  clearAuditFilterField,
  createAuditFilter,
  formatAuditJson,
  formatAuditTime,
  getActiveAuditFilterSummary,
  getOperationTagType,
  getOperationTypeLabel,
  getStatusIndicatorStatus,
  getStatusLabel,
  hasActiveAuditFilter
} from './auditManagerModel.js'

describe('auditManagerModel', () => {
  it('builds trimmed API parameters with pagination overrides', () => {
    const filter = createAuditFilter()
    Object.assign(filter, {
      userId: ' user-1 ',
      keyword: ' command ',
      dateRange: ['2026-01-01 00:00:00', '2026-01-02 00:00:00']
    })

    expect(buildAuditFilterParams(filter, { limit: 20, offset: 40 })).toEqual({
      userId: 'user-1',
      keyword: 'command',
      startTime: '2026-01-01 00:00:00',
      endTime: '2026-01-02 00:00:00',
      limit: 20,
      offset: 40
    })
  })

  it('creates labels for active filters and clears them by label', () => {
    const filter = createAuditFilter()
    filter.operationType = 'FILE_READ'
    filter.status = 'FAILED'

    expect(hasActiveAuditFilter(filter)).toBe(true)
    expect(getActiveAuditFilterSummary(filter)).toEqual({
      操作类型: '读取文件',
      状态: '失败'
    })
    expect(clearAuditFilterField(filter, '操作类型')).toBe(true)
    expect(filter.operationType).toBe('')
    expect(clearAuditFilterField(filter, '未知')).toBe(false)
  })

  it('does not treat whitespace-only values as an active deletion filter', () => {
    const filter = createAuditFilter()
    filter.keyword = '   '
    filter.userId = '\t'

    expect(hasActiveAuditFilter(filter)).toBe(false)
    expect(getActiveAuditFilterSummary(filter)).toEqual({})
    expect(buildAuditFilterParams(filter)).toEqual({})
  })

  it('maps operation and status presentation consistently', () => {
    expect(getOperationTypeLabel('AUDIT_LOG_DELETE')).toBe('删除审计日志')
    expect(getOperationTypeLabel('CUSTOM_ACTION')).toBe('CUSTOM_ACTION')
    expect(getOperationTagType('SQL_QUERY')).toBe('warning')
    expect(getStatusLabel('ERROR')).toBe('错误')
    expect(getStatusIndicatorStatus('PENDING')).toBe('waiting')
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
