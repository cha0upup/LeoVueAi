import { describe, expect, it } from 'vitest'
import { buildFullPath, parseAbsolutePath } from './useFilePath.js'

describe('remote file path semantics', () => {
  it('round-trips Windows drive paths', () => {
    expect(parseAbsolutePath('C:\\Windows\\System32')).toEqual({
      disk: 'C:',
      relativePath: 'Windows/System32'
    })
    expect(buildFullPath('C:', 'Windows/System32')).toBe('C:/Windows/System32')
  })

  it('round-trips UNC share paths', () => {
    expect(parseAbsolutePath('\\\\server\\share\\folder\\file.txt')).toEqual({
      disk: '//server/share',
      relativePath: 'folder/file.txt'
    })
    expect(buildFullPath('//server/share', 'folder/file.txt'))
      .toBe('//server/share/folder/file.txt')
  })

  it('round-trips POSIX paths', () => {
    expect(parseAbsolutePath('/var/log')).toEqual({
      disk: '/',
      relativePath: 'var/log'
    })
    expect(buildFullPath('/', 'var/log')).toBe('/var/log')
  })
})
