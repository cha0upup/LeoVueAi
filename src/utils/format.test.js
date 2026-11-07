import { describe, expect, it } from 'vitest'
import { clampProgress, formatDate, formatFilePath, joinFilePath, normalizeDirectoryPath } from './format.js'

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

describe('shared file directory paths', () => {
  it.each([
    [undefined, '/'],
    ['', '/'],
    ['/', '/'],
    ['/.', '/'],
    ['/var//log/', '/var/log'],
    ['/var/log/.', '/var/log'],
    ['C:', 'C:/'],
    ['C:\\', 'C:/'],
    ['C:/.', 'C:/'],
    ['C:\\Temp\\', 'C:/Temp'],
    ['\\\\server\\share\\', '//server/share'],
    ['//server/share/folder/.', '//server/share/folder']
  ])('normalizes %s and joins a file without changing its root', (input, directory) => {
    expect(normalizeDirectoryPath(input)).toBe(directory)
    const expected = `${directory}${directory.endsWith('/') ? '' : '/'}文件.txt`
    expect(joinFilePath(input, '文件.txt')).toBe(expected)
    expect(normalizeDirectoryPath(directory)).toBe(directory)
  })
})

describe('formatDate', () => {
  it('formats file and general timestamps consistently in local time', () => {
    const date = new Date(2026, 0, 2, 3, 4, 5)
    for (const value of [date, date.getTime(), date.toISOString()]) {
      expect(formatDate(value)).toBe('2026-01-02 03:04:05')
    }
  })

  it.each([undefined, null, 0, '', 'bad', NaN, Infinity])('uses a placeholder for %s', value => {
    expect(formatDate(value)).toBe('-')
  })
})
