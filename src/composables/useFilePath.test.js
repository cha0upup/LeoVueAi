import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { buildFullPath, parseAbsolutePath, useFilePath } from './useFilePath.js'

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

  it('keeps only reactive navigation state in the composable API', () => {
    const disk = ref('C:')
    const currentPath = ref('Windows/System32')
    const navigation = useFilePath({ disk, currentPath })
    expect(Object.keys(navigation)).toEqual(['breadcrumbs', 'currentFullPath', 'canGoBack'])
    expect(navigation.currentFullPath.value).toBe('C:/Windows/System32')
    expect(navigation.breadcrumbs.value).toEqual([
      { text: 'C:', link: 'C:/' }, { text: 'Windows', link: 'C:/Windows' },
      { text: 'System32', link: 'C:/Windows/System32' }
    ])
    disk.value = '/'
    currentPath.value = ''
    expect(navigation.currentFullPath.value).toBe('/')
    expect(navigation.canGoBack.value).toBe(false)
    expect(navigation.breadcrumbs.value).toEqual([{ text: '/', link: '/' }])
  })
})
