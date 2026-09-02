import { describe, expect, it, vi } from 'vitest'

vi.mock('@/services/api.js', () => ({
  userFileCreateDirApi: vi.fn(),
  userFileUploadApi: vi.fn()
}))

import {
  buildAiReportMarkdown,
  sanitizeArtifactName
} from './artifactArchive.js'

describe('artifactArchive', () => {
  it('sanitizes generated file names without losing Chinese labels', () => {
    expect(sanitizeArtifactName('  平台报告 / Host #1  ')).toBe('平台报告-host-1')
    expect(sanitizeArtifactName('***', 'report')).toBe('report')
  })

  it('builds an AI report from user and assistant turns', () => {
    const report = buildAiReportMarkdown({
      title: '主机分析',
      threadId: 'thread-1',
      messages: [
        { role: 'user', content: '检查风险' },
        { role: 'assistant', content: '发现一项风险' }
      ]
    })

    expect(report).toContain('# 主机分析')
    expect(report).toContain('## 问题 1')
    expect(report).toContain('发现一项风险')
  })
})
