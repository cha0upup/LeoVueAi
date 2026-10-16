import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/api/user-space.js', () => ({
  archiveUserArtifactApi: vi.fn()
}))

import { archiveUserArtifactApi } from '@/services/api/user-space.js'

import {
  buildAiReportMarkdown,
  archiveTextArtifact,
  sanitizeArtifactName
} from './artifactArchive.js'

describe('artifactArchive', () => {
  beforeEach(() => vi.resetAllMocks())

  it('archives content and provenance together and uses the server file path', async () => {
    archiveUserArtifactApi.mockResolvedValue({ data: { path: 'ai-reports/server-id-report.md' } })
    const result = await archiveTextArtifact({ category: 'ai-reports', name: '主机分析', extension: 'md', content: '# Report',
      metadata: { sourceModule: 'node-ai', sourceId: 'thread-a', hostName: 'server-a' } })
    expect(result.path).toBe('ai-reports/server-id-report.md')
    expect(archiveUserArtifactApi).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      category: 'ai-reports', content: '# Report', filename: expect.stringMatching(/-主机分析\.md$/),
      metadata: { title: '主机分析', sourceModule: 'node-ai', sourceId: 'thread-a', hostName: 'server-a' }
    }))
  })

  it('rejects empty content before sending an archive request', async () => {
    await expect(archiveTextArtifact({ category: 'ai-reports', content: '  ' })).rejects.toThrow()
    expect(archiveUserArtifactApi).not.toHaveBeenCalled()
  })
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
    expect(report).toContain('对话范围：当前已加载内容')
  })

  it('labels a full conversation report explicitly', () => {
    expect(buildAiReportMarkdown({ historyScope: 'full', messages: [] })).toContain('对话范围：完整会话')
  })
})
