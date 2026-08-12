import { describe, expect, it } from 'vitest'
import { formatFilePath } from './format.js'

describe('formatFilePath', () => {
  it('preserves UNC roots while normalizing separators', () => {
    expect(formatFilePath('\\\\server\\share\\folder\\\\file.txt'))
      .toBe('//server/share/folder/file.txt')
    expect(formatFilePath('//server/share/')).toBe('//server/share')
  })

  it('normalizes Windows drive paths without making them drive-relative', () => {
    expect(formatFilePath('D:folder\\file.txt')).toBe('D:/folder/file.txt')
    expect(formatFilePath('D:\\')).toBe('D:/')
  })

  it('normalizes POSIX paths', () => {
    expect(formatFilePath('/var//log/')).toBe('/var/log')
    expect(formatFilePath('/')).toBe('/')
  })
})
