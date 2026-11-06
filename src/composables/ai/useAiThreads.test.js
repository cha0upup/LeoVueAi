import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { deferred } from '@/test-support/deferred.js'
import { nodeAiThreadMessagesApi } from '@/services/api/node-ai.js'
import { showError } from '@/utils/messageUtils.js'
import { useAiThreads } from './useAiThreads.js'

vi.mock('@/services/api/node-ai.js', () => ({
  nodeAiThreadListApi: vi.fn(), nodeAiThreadCreateApi: vi.fn(), nodeAiThreadDeleteApi: vi.fn(),
  nodeAiThreadRenameApi: vi.fn(), nodeAiThreadMessagesApi: vi.fn()
}))
vi.mock('@/utils/messageUtils.js', () => ({ showError: vi.fn() }))

describe('node AI history loading', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uses the shared current page contract', async () => {
    const page = { messages: [{ messageId: 'message-3', sequence: 3 }], hasMore: true, nextBeforeSequence: 3 }
    nodeAiThreadMessagesApi.mockResolvedValue({ data: page })
    const threads = useAiThreads({ sessionId: ref('session-one') })
    expect(await threads.loadMessages('thread-one')).toEqual(page)
    expect(nodeAiThreadMessagesApi).toHaveBeenCalledWith({ sessionId: 'session-one', threadId: 'thread-one', offset: 0, limit: 50 })
  })

  it('surfaces missing pagination metadata rather than presenting empty history', async () => {
    nodeAiThreadMessagesApi.mockResolvedValue({ data: { messages: [] } })
    const threads = useAiThreads({ sessionId: ref('session-one') })
    await expect(threads.loadMessages('thread-one')).rejects.toThrow('分页响应格式异常')
    expect(showError).toHaveBeenCalledOnce()
  })

  it('discards stale data after the node session changes', async () => {
    const pending = deferred()
    nodeAiThreadMessagesApi.mockReturnValue(pending.promise)
    const sessionId = ref('session-one')
    const threads = useAiThreads({ sessionId })
    const loading = threads.loadMessages('thread-one')
    sessionId.value = 'session-two'
    pending.resolve({ data: {} })
    expect(await loading).toEqual({ messages: [], hasMore: false, nextBeforeSequence: null, stale: true })
    expect(showError).not.toHaveBeenCalled()
  })

  it('does not request history without a session or thread', async () => {
    const threads = useAiThreads({ sessionId: ref('') })
    expect(await threads.loadMessages('thread-one')).toEqual({ messages: [], hasMore: false, nextBeforeSequence: null })
    expect(nodeAiThreadMessagesApi).not.toHaveBeenCalled()
  })
})
