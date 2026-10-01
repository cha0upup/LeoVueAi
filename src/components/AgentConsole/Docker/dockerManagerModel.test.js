import { describe, expect, it } from 'vitest'
import {
  formatDockerInfo,
  getDockerPayload,
  getDockerExportConfig,
  getDockerResourceId,
  isDockerContainerPaused,
  isDockerContainerRunning,
  normalizeDockerList,
  quoteShellArg,
} from './dockerManagerModel.js'

describe('dockerManagerModel', () => {
  it('reads the current API payload and normalizes malformed lists', () => {
    const response = { data: { code: 200, data: { containers: [{ id: 'one' }] } } }
    expect(getDockerPayload(response)).toEqual({ containers: [{ id: 'one' }] })
    expect(normalizeDockerList(response, 'containers')).toEqual([{ id: 'one' }])
    expect(normalizeDockerList({ data: { images: null } }, 'images')).toEqual([])
    expect(normalizeDockerList({}, 'unknown')).toEqual([])
  })

  it('uses the backend resource id for every Docker resource', () => {
    expect(getDockerResourceId({ id: 'abc', name: 'web' })).toBe('abc')
    expect(getDockerResourceId({ name: 'web' })).toBe('')
    expect(getDockerResourceId({ id: 'sha256:abc', repository: 'nginx', tag: 'latest' })).toBe(
      'sha256:abc'
    )
    expect(getDockerResourceId({ repository: 'nginx' })).toBe('')
  })

  it('recognizes a paused running container', () => {
    expect(isDockerContainerRunning('Up 2 minutes (Paused)')).toBe(true)
    expect(isDockerContainerPaused('Up 2 minutes (Paused)')).toBe(true)
  })

  it('returns isolated export metadata and formats info payloads', () => {
    const first = getDockerExportConfig('containers')
    first.columns.pop()
    expect(getDockerExportConfig('containers').columns).toHaveLength(6)
    expect(formatDockerInfo({ data: { code: 200, data: { logs: '' } } }, 'logs', '(无日志)')).toBe(
      '(无日志)'
    )
    expect(formatDockerInfo({ data: { code: 200, data: { inspect: { Id: 'abc' } } } }, 'inspect')).toBe(
      '{\n  "Id": "abc"\n}'
    )
  })

  it('quotes shell arguments containing spaces and apostrophes', () => {
    expect(quoteShellArg('plain id')).toBe("'plain id'")
    expect(quoteShellArg("a'b")).toBe("'a'\"'\"'b'")
  })
})
