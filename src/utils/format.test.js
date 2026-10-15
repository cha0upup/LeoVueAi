import { describe, expect, it } from 'vitest'
import { clampProgress, formatFilePath } from './format.js'

it('clamps progress while preserving fractional values and rejecting non-finite numbers', () => {
  const cases = [[undefined, 0], [null, 0], [NaN, 0], [Infinity, 0], ['bad', 0], [-5, 0], ['37.125', 37.125], [150, 100]]
  for (const [value, expected] of cases) expect(clampProgress(value)).toBe(expected)
})

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
