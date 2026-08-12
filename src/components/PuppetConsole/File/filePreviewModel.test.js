import { describe, expect, it } from 'vitest'
import {
  detectFileLineEnding,
  getPreviewDisplayName,
  getPreviewTypeLabel,
  getTextPreviewStats,
  isSamePreviewTarget,
  isTextFilePreview,
  normalizeFileLineEndings,
  resolvePreviewFileSize,
  shortenPreviewPath,
  splitPreviewDownloadPath
} from './filePreviewModel.js'

describe('filePreviewModel', () => {
  it('resolves names, labels and shortened paths', () => {
    expect(getPreviewDisplayName('C:\\Temp\\a.txt')).toBe('a.txt')
    expect(getPreviewTypeLabel('pdf')).toBe('PDF预览')
    expect(isTextFilePreview('image')).toBe(false)
    expect(shortenPreviewPath('1234567890', 8, 2)).toBe('12...90')
  })

  it('detects and normalizes line endings', () => {
    expect(detectFileLineEnding('', 'run.cmd')).toBe('CRLF')
    expect(detectFileLineEnding('a\r\nb')).toBe('CRLF')
    expect(normalizeFileLineEndings('a\r\nb\rc', 'LF')).toBe('a\nb\nc')
    expect(getTextPreviewStats('a\nb')).toEqual({ lineCount: 2, charCount: 3 })
  })

  it('resolves metadata and download paths defensively', () => {
    expect(resolvePreviewFileSize({ size: '12' })).toBe(12)
    expect(resolvePreviewFileSize({}, { length: -1 })).toBe(0)
    expect(splitPreviewDownloadPath('C:\\Temp\\a.txt')).toEqual({
      directoryPath: 'C:/Temp/',
      fileName: 'a.txt'
    })
  })

  it('compares preview request identities', () => {
    expect(isSamePreviewTarget(
      { sessionId: 's', filePath: '/a' },
      { sessionId: 's', filePath: '/a' }
    )).toBe(true)
    expect(isSamePreviewTarget(
      { sessionId: 's', filePath: '/a' },
      { sessionId: 's2', filePath: '/a' }
    )).toBe(false)
  })
})
