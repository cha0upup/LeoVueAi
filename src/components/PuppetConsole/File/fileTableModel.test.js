import { describe, expect, it, vi } from 'vitest'
import {
  filterFileEntries,
  formatFileModifiedDate,
  getFileEntryKey,
  getFilePreviewMeta,
  normalizeFileEntries,
  resolveCurrentFileDirectory,
  resolveFileEntryPath,
  resolveFileExtensionTagType,
  settleWithConcurrency,
  sortFileEntries,
  summarizeFileEntries
} from './fileTableModel.js'

describe('fileTableModel', () => {
  it('normalizes, sorts and summarizes malformed entries defensively', () => {
    const entries = normalizeFileEntries([
      { path: '/z.txt', isFile: 1, size: '3' },
      { name: '目录', isDirectory: 1 }
    ])
    expect(sortFileEntries(entries).map(file => file.name)).toEqual(['目录', '/z.txt'])
    expect(summarizeFileEntries(entries)).toEqual({ total: 2, directories: 1, files: 1 })
    expect(getFilePreviewMeta(entries[0])).toEqual({ name: '/z.txt', size: 3, extension: '' })
    expect(getFileEntryKey(entries[1])).toBe('dir:目录')
  })

  it('filters by entry type and case-insensitive keyword', () => {
    const entries = [
      { name: 'Docs', extension: '', isDirectory: true },
      { name: 'README.MD', extension: 'md', isDirectory: false }
    ]
    expect(filterFileEntries(entries, { keyword: 'read', type: 'file' })).toEqual([entries[1]])
    expect(filterFileEntries(entries, { type: 'dir' })).toEqual([entries[0]])
  })

  it('resolves paths and presentation metadata across platforms', () => {
    expect(resolveCurrentFileDirectory('/', 'var/log')).toBe('/var/log')
    expect(resolveCurrentFileDirectory('C:', 'Temp')).toBe('C:/Temp')
    expect(resolveFileEntryPath({ name: 'app.log' }, { absolutePath: '/var/log' })).toBe('/var/log/app.log')
    expect(resolveFileEntryPath({ path: 'C:\\Temp\\a.txt' })).toBe('C:/Temp/a.txt')
    expect(resolveFileExtensionTagType('ZIP')).toBe('warning')
    expect(formatFileModifiedDate('bad')).toBe('-')
  })

  it('settles work with bounded concurrency and preserves item order', async () => {
    let active = 0
    let maxActive = 0
    const worker = vi.fn(async value => {
      active += 1
      maxActive = Math.max(maxActive, active)
      await Promise.resolve()
      active -= 1
      if (value === 2) throw new Error('failed')
      return value * 2
    })
    const results = await settleWithConcurrency([1, 2, 3], 2, worker)
    expect(maxActive).toBe(2)
    expect(results.map(result => result.status)).toEqual(['fulfilled', 'rejected', 'fulfilled'])
    expect(results[2].value).toBe(6)
  })
})
