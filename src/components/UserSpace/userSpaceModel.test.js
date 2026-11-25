import { describe, expect, it } from 'vitest'
import {
  detectUserSpaceLanguage,
  getUserSpaceEntryIconKey,
  getUserSpaceFileExtension,
  isDownloadOnlyArtifact,
  normalizeWorkspaceOverview,
  resolveArtifactCategoryLabel,
  resolveArtifactSourceLabel
} from './userSpaceModel.js'

describe('userSpaceModel', () => {
  it('detects extensions and Monaco languages case-insensitively', () => {
    expect(getUserSpaceFileExtension('Report.JSON')).toBe('json')
    expect(getUserSpaceFileExtension('folder.with.dot/README')).toBe('')
    expect(getUserSpaceFileExtension('folder.with.dot/file.')).toBe('')
    expect(getUserSpaceFileExtension('README')).toBe('')
    expect(detectUserSpaceLanguage('component.VUE')).toBe('html')
    expect(detectUserSpaceLanguage('report.MARKDOWN')).toBe('markdown')
    expect(detectUserSpaceLanguage('archive.bin')).toBe('plaintext')
  })

  it('resolves artifact labels and file icons with fallbacks for old files', () => {
    expect(resolveArtifactCategoryLabel('ai-reports')).toBe('AI 分析报告')
    expect(resolveArtifactSourceLabel('node-ai')).toBe('节点 AI')
    expect(resolveArtifactSourceLabel()).toBe('来源未记录')
    expect(getUserSpaceEntryIconKey({ name: 'report.MD' })).toBe('markdown')
    expect(getUserSpaceEntryIconKey({ name: 'output.bin' })).toBe('file')
  })

  it('skips text preview for known non-text formats but keeps SVG and unknown files eligible', () => {
    for (const name of ['notes.PDF', 'picture.png', 'data.xlsx', 'recording.mp4', 'backup.tar.gz']) {
      expect(isDownloadOnlyArtifact({ name })).toBe(true)
    }
    for (const name of ['logo.svg', 'readme', 'unknown.bin', 'report.md', 'rows.csv']) {
      expect(isDownloadOnlyArtifact({ name })).toBe(false)
    }
  })

  it('normalizes incomplete overview payloads', () => {
    expect(
      normalizeWorkspaceOverview({ totalFiles: '3', totalBytes: 'invalid', categories: null })
    ).toEqual({
      totalFiles: 3,
      totalBytes: 0,
      categories: []
    })
  })
})
