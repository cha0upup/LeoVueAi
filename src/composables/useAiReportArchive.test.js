import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useAiReportArchive } from './useAiReportArchive.js'
import { archiveUserArtifactApi } from '@/services/api/user-space.js'
import { showError, showSuccess } from '@/utils/messageUtils.js'

vi.mock('@/services/api/user-space.js', () => ({ archiveUserArtifactApi: vi.fn() }))
vi.mock('@/utils/messageUtils.js', () => ({ showError: vi.fn(), showSuccess: vi.fn() }))

const records = [
  { role: 'user', messageId: 'user-1', sequence: 1, content: '历史问题' },
  { role: 'assistant', messageId: 'assistant-1', sequence: 2, content: '完整分析' }
]

function fixture(sourceModule = 'platform-ai') {
  const context = { title: '报告标题', threadId: 'thread-1', model: 'model-1' }
  if (sourceModule === 'node-ai') Object.assign(context, { sessionId: 'session-1', hostName: 'host-1' })
  const messages = ref([{ role: 'assistant', content: '仅首屏内容' }])
  const busy = ref(false)
  const loadMessages = vi.fn(async () => records)
  const archive = useAiReportArchive({
    sourceModule, messages, isBusy: () => busy.value, getContext: () => context, loadMessages
  })
  return { archive, context, messages, busy, loadMessages }
}

describe('shared AI report archive', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    archiveUserArtifactApi.mockResolvedValue({ data: { path: 'ai-reports/report.md' } })
  })

  it.each([['platform-ai', '平台'], ['node-ai', '节点']])(
    'preserves %s provenance and archives complete history', async (sourceModule, label) => {
      const { archive, loadMessages } = fixture(sourceModule)

      expect(await archive.archiveCurrentReport()).toEqual({ path: 'ai-reports/report.md' })

      expect(loadMessages).toHaveBeenCalledExactlyOnceWith('thread-1')
      const request = archiveUserArtifactApi.mock.calls[0][0]
      expect(request.category).toBe('ai-reports')
      expect(request.metadata).toEqual({
        title: '报告标题', sourceModule, sourceId: 'thread-1',
        ...(sourceModule === 'node-ai' ? { sessionId: 'session-1', hostName: 'host-1' } : {})
      })
      expect(request.content).toContain(`报告类型：${label} AI 分析`)
      expect(request.content).toContain('对话范围：完整会话')
      expect(request.content).toContain('历史问题')
      expect(request.content).toContain('完整分析')
      expect(request.content).not.toContain('仅首屏内容')
      expect(archive.archivingReport.value).toBe(false)
      expect(showSuccess).toHaveBeenCalledOnce()
    })

  it('captures context before awaiting history and ignores duplicate archive clicks', async () => {
    const { archive, context, loadMessages } = fixture('node-ai')
    let resolve
    loadMessages.mockImplementation(() => new Promise(done => { resolve = done }))
    const pending = archive.archiveCurrentReport()
    expect(archive.archivingReport.value).toBe(true)
    Object.assign(context, { title: 'other', threadId: 'thread-2', sessionId: 'session-2', hostName: 'host-2', model: 'model-2' })
    await archive.archiveCurrentReport()
    expect(loadMessages).toHaveBeenCalledTimes(1)
    resolve(records)
    await pending

    expect(archiveUserArtifactApi).toHaveBeenCalledOnce()
    const request = archiveUserArtifactApi.mock.calls[0][0]
    expect(request.metadata).toMatchObject({ title: '报告标题', sourceId: 'thread-1', sessionId: 'session-1', hostName: 'host-1' })
    expect(request.content).toContain('使用模型：model-1')
  })

  it('keeps busy or empty conversations out of the archive flow', async () => {
    const { archive, busy, messages, loadMessages } = fixture()
    busy.value = true
    expect(archive.canArchiveReport.value).toBe(false)
    await archive.archiveCurrentReport()
    busy.value = false
    messages.value = [{ role: 'user' }]
    expect(archive.canArchiveReport.value).toBe(false)
    await archive.archiveCurrentReport()
    expect(loadMessages).not.toHaveBeenCalled()
  })

  it('clears loading on failure without archiving partial history', async () => {
    const { archive, loadMessages } = fixture()
    loadMessages.mockRejectedValue(new Error('history unavailable'))

    await archive.archiveCurrentReport()

    expect(archiveUserArtifactApi).not.toHaveBeenCalled()
    expect(archive.archivingReport.value).toBe(false)
    expect(showError).toHaveBeenCalledWith('归档分析报告失败：history unavailable')
    expect(showSuccess).not.toHaveBeenCalled()
  })
})
