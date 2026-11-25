import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/api/user-space.js', () => ({
  archiveUserArtifactApi: vi.fn()
}))

import { archiveUserArtifactApi } from '@/services/api/user-space.js'

import { archiveTextArtifact, sanitizeArtifactName } from './artifactArchive.js'

describe('artifactArchive', () => {
  beforeEach(() => vi.resetAllMocks())

  it('rejects empty content before sending an archive request', async () => {
    await expect(archiveTextArtifact({ category: 'ai-reports', content: '  ' })).rejects.toThrow()
    expect(archiveUserArtifactApi).not.toHaveBeenCalled()
  })

  it('sanitizes generated file names without losing Chinese labels', () => {
    expect(sanitizeArtifactName('  平台报告 / Host #1  ')).toBe('平台报告-host-1')
    expect(sanitizeArtifactName('***', 'report')).toBe('report')
  })
})
