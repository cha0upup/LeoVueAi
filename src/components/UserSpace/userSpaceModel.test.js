import { describe, expect, it } from 'vitest'
import {
  detectUserSpaceLanguage,
  getUserSpaceEntryIconKey,
  getUserSpaceFileExtension,
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

  it('normalizes incomplete overview payloads', () => {
    expect(
      normalizeWorkspaceOverview({ totalFiles: '3', totalBytes: 'invalid', recentFiles: null })
    ).toEqual({
      totalFiles: 3,
      totalDirectories: 0,
      totalBytes: 0,
      maxUploadBytes: 0,
      rootItems: 0,
      updatedAt: 0,
      recentFiles: [],
      categories: []
    })
  })
})
