import { describe, expect, it } from 'vitest'
import {
  appendBoundedEventLogEntries,
  buildEventLogAggregateParams,
  buildEventLogQueryParams,
  formatEventLogValue,
  getEventLogLevel,
  isEventLogAccessFormat,
  resolveEventLogLevelTagType,
  resolveEventLogSourceIcon,
  resolveHttpStatusTagType
} from './eventLogModel.js'

describe('eventLogModel', () => {
  it('resolves formats, source icons and severity colors', () => {
    expect(isEventLogAccessFormat('nginx-access')).toBe(true)
    expect(isEventLogAccessFormat('tomcat')).toBe(false)
    expect(resolveEventLogSourceIcon('mysql')).toBe('simple-icons:mysql')
    expect(resolveEventLogSourceIcon('unknown')).toBe('mdi:text-box')
    expect(resolveHttpStatusTagType('503')).toBe('danger')
    expect(resolveHttpStatusTagType('204')).toBe('success')
    expect(resolveEventLogLevelTagType('WARN')).toBe('warning')
    expect(getEventLogLevel({ Level: 'Error', level: 'info' })).toBe('Error')
  })

  it('builds normalized query and aggregate parameters', () => {
    expect(
      buildEventLogQueryParams(
        { source: '/a.log', keyword: '', level: 'error', since: '1h', format: '' },
        { cursor: 120, direction: 'older', since: '' }
      )
    ).toEqual({
      source: '/a.log',
      maxEntries: 200,
      keyword: undefined,
      level: 'error',
      since: undefined,
      format: undefined,
      cursor: 120,
      direction: 'older'
    })
    expect(
      buildEventLogAggregateParams({
        source: '/a.log',
        format: '',
        groupBy: 'ip',
        topN: 20,
        maxBytes: 0,
        slow: true,
        keyword: '',
        minStatus: null,
        maxStatus: 499
      })
    ).toMatchObject({ slow: 'true', maxBytes: undefined, minStatus: undefined, maxStatus: 499 })
  })

  it('keeps only the newest streamed entries', () => {
    expect(appendBoundedEventLogEntries([1, 2], [3, 4, 5], 3)).toEqual([3, 4, 5])
    expect(appendBoundedEventLogEntries(null, null, 3)).toEqual([])
  })

  it('formats circular values without throwing', () => {
    const value = {}
    value.self = value
    expect(formatEventLogValue(value)).toBe('[对象序列化失败]')
  })

})
