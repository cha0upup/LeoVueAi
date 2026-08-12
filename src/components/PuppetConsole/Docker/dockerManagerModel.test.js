import { describe, expect, it } from 'vitest'
import {
  formatDockerInfo,
  getDockerExportConfig,
  getDockerResourceId,
  getDockerStatusTag,
  isDockerContainerPaused,
  isDockerContainerRunning,
  normalizeDockerList,
  quoteShellArg,
  unwrapDockerResponse
} from './dockerManagerModel.js'

describe('dockerManagerModel', () => {
  it('unwraps nested API payloads and normalizes malformed lists', () => {
    const response = { data: { code: 0, data: { containers: [{ id: 'one' }] } } }
    expect(unwrapDockerResponse(response)).toEqual({ containers: [{ id: 'one' }] })
    expect(normalizeDockerList(response, 'containers')).toEqual([{ id: 'one' }])
    expect(normalizeDockerList({ data: { images: null } }, 'images')).toEqual([])
    expect(normalizeDockerList({}, 'unknown')).toEqual([])
  })

  it('derives resource identifiers without creating dangling image separators', () => {
    expect(getDockerResourceId({ id: 'abc', name: 'web' })).toBe('abc')
    expect(getDockerResourceId({ name: 'web' })).toBe('web')
    expect(getDockerResourceId({ repository: 'nginx', tag: 'latest' }, 'image')).toBe(
      'nginx:latest'
    )
    expect(getDockerResourceId({ repository: 'nginx' }, 'image')).toBe('nginx')
  })

  it('maps container states consistently', () => {
    expect(isDockerContainerRunning('Up 2 minutes (Paused)')).toBe(true)
    expect(isDockerContainerPaused('Up 2 minutes (Paused)')).toBe(true)
    expect(getDockerStatusTag('Up 2 minutes (Paused)')).toBe('warning')
    expect(getDockerStatusTag('Exited (0)')).toBe('danger')
    expect(getDockerStatusTag()).toBe('info')
  })

  it('returns isolated export metadata and formats info payloads', () => {
    const first = getDockerExportConfig('containers')
    first.columns.pop()
    expect(getDockerExportConfig('containers').columns).toHaveLength(6)
    expect(formatDockerInfo({ data: { logs: '' } }, 'logs', '(无日志)')).toBe('(无日志)')
    expect(formatDockerInfo({ data: { inspect: { Id: 'abc' } } }, 'inspect')).toBe(
      '{\n  "Id": "abc"\n}'
    )
  })

  it('quotes shell arguments containing spaces and apostrophes', () => {
    expect(quoteShellArg('plain id')).toBe("'plain id'")
    expect(quoteShellArg("a'b")).toBe("'a'\"'\"'b'")
  })
})
