import { describe, expect, it, vi } from 'vitest'

vi.mock('@/services/api.js', () => ({
  userFileCreateDirApi: vi.fn(),
  userFileUploadApi: vi.fn()
}))

import {
  buildAiReportMarkdown,
  buildTaskResultMarkdown,
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

  it('preserves structured task results as readable JSON', () => {
    const report = buildTaskResultMarkdown({
      title: '扫描任务',
      taskId: 'task-1',
      status: 'completed',
      progress: 100,
      result: { hosts: 2 }
    })

    expect(report).toContain('# 扫描任务')
    expect(report).toContain('```json')
    expect(report).toContain('"hosts": 2')
  })
})
