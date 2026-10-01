import { describe, expect, it } from 'vitest'
import {
  detectFileLineEnding,
  getPreviewDisplayName,
  getTextPreviewStats,
  isTextFilePreview,
  normalizeFileLineEndings,
  resolvePreviewFileSize,
  splitPreviewDownloadPath
} from './filePreviewModel.js'

describe('filePreviewModel', () => {
  it('resolves Windows file names and distinguishes text previews', () => {
    expect(getPreviewDisplayName('C:\\Temp\\a.txt')).toBe('a.txt')
    expect(isTextFilePreview('image')).toBe(false)
  })

  it('detects and normalizes line endings', () => {
    expect(detectFileLineEnding('', 'run.cmd')).toBe('CRLF')
    expect(detectFileLineEnding('a\r\nb')).toBe('CRLF')
    expect(normalizeFileLineEndings('a\r\nb\rc', 'LF')).toBe('a\nb\nc')
    expect(getTextPreviewStats('a\nb')).toEqual({ lineCount: 2, charCount: 3 })
  })

  it('resolves metadata and download paths defensively', () => {
    expect(resolvePreviewFileSize({ size: '12' })).toBe(12)
    expect(resolvePreviewFileSize({ size: -1 })).toBe(0)
    expect(splitPreviewDownloadPath('C:\\Temp\\a.txt')).toEqual({
      directoryPath: 'C:/Temp/',
      fileName: 'a.txt'
    })
  })
})
