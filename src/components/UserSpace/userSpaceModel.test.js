import { describe, expect, it } from 'vitest'
import {
  detectUserSpaceLanguage,
  filterUserSpaceEntries,
  getUserSpaceEntryIconKey,
  getUserSpaceFileExtension,
  isArtifactCategoryPath,
  joinUserSpacePath,
  normalizeWorkspaceOverview,
  resolveArtifactCategoryLabel,
  sortUserSpaceEntries
} from './userSpaceModel.js'

describe('userSpaceModel', () => {
  it('joins relative workspace paths without duplicate edge separators', () => {
    expect(joinUserSpacePath('/reports/', '/daily/a.md/')).toBe('reports/daily/a.md')
    expect(joinUserSpacePath('', '/a.txt')).toBe('a.txt')
    expect(joinUserSpacePath('root', '')).toBe('root')
  })

  it('detects extensions and Monaco languages case-insensitively', () => {
    expect(getUserSpaceFileExtension('Report.JSON')).toBe('json')
    expect(getUserSpaceFileExtension('folder.with.dot/README')).toBe('')
    expect(getUserSpaceFileExtension('folder.with.dot/file.')).toBe('')
    expect(getUserSpaceFileExtension('README')).toBe('')
    expect(detectUserSpaceLanguage('component.VUE')).toBe('html')
    expect(detectUserSpaceLanguage('archive.bin')).toBe('plaintext')
  })

  it('filters by name or path and sorts directories first without mutating input', () => {
    const entries = [
      { name: 'z.txt', path: 'logs/z.txt', isDirectory: false },
      { name: 'Alpha', path: 'Alpha', isDirectory: true },
      { name: 'beta.txt', path: 'reports/beta.txt', isDirectory: false }
    ]
    expect(filterUserSpaceEntries(entries, ' REPORTS ')).toEqual([entries[2]])
    expect(sortUserSpaceEntries(entries).map((item) => item.name)).toEqual([
      'Alpha',
      'beta.txt',
      'z.txt'
    ])
    expect(entries[0].name).toBe('z.txt')
  })

  it('resolves category labels and entry icon kinds', () => {
    expect(resolveArtifactCategoryLabel('ai-reports')).toBe('AI 分析报告')
    expect(resolveArtifactCategoryLabel('custom')).toBe('custom')
    expect(isArtifactCategoryPath('task-results')).toBe(true)
    expect(isArtifactCategoryPath('custom')).toBe(false)
    expect(getUserSpaceEntryIconKey({ isDirectory: true })).toBe('folder')
    expect(getUserSpaceEntryIconKey({ name: 'report.pdf' })).toBe('filePdf')
    expect(getUserSpaceEntryIconKey({ name: 'main.ts' })).toBe('codeFile')
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
      topDirectories: []
    })
  })
})
