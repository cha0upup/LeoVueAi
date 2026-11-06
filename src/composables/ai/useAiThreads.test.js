import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { deferred } from '@/test-support/deferred.js'
import {
  nodeAiThreadListApi, nodeAiThreadCreateApi, nodeAiThreadDeleteApi,
  nodeAiThreadRenameApi, nodeAiThreadMessagesApi
} from '@/services/api/node-ai.js'
import { showError } from '@/utils/messageUtils.js'
import { useAiThreads } from './useAiThreads.js'

vi.mock('@/services/api/node-ai.js', () => ({
  nodeAiThreadListApi: vi.fn(), nodeAiThreadCreateApi: vi.fn(), nodeAiThreadDeleteApi: vi.fn(),
  nodeAiThreadRenameApi: vi.fn(), nodeAiThreadMessagesApi: vi.fn()
}))
vi.mock('@/utils/messageUtils.js', () => ({ showError: vi.fn() }))

const scopes = []
afterEach(() => scopes.splice(0).forEach(scope => scope.stop()))
function scopedThreads() {
  const sessionId = ref('session-one')
  const scope = effectScope()
  scopes.push(scope)
  const model = scope.run(() => useAiThreads({ sessionId }))
  return { model, sessionId, scope }
}

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

  it('suppresses list errors from a previous session even without a replacement request', async () => {
    const { model, sessionId } = scopedThreads()
    const pending = deferred()
    nodeAiThreadListApi.mockReturnValueOnce(pending.promise)
    const request = model.fetchThreads()
    sessionId.value = 'session-two'
    pending.reject(new Error('old session failed'))
    await request
    expect(showError).not.toHaveBeenCalled()
    expect(model.loading.value).toBe(false)
  })

  it.each(['create', 'delete', 'rename'].flatMap(operation =>
    ['switch-return', 'dispose'].map(transition => [operation, transition])
  ))('ignores a late %s after %s', async (operation, transition) => {
    const { model, sessionId, scope } = scopedThreads()
    const pending = deferred()
    const api = { create: nodeAiThreadCreateApi, delete: nodeAiThreadDeleteApi, rename: nodeAiThreadRenameApi }[operation]
    api.mockReturnValueOnce(pending.promise)
    const requests = {
      create: () => model.createThread(),
      delete: () => model.deleteThread('target'),
      rename: () => model.renameThread('target', 'Outdated title')
    }
    const request = requests[operation]()
    if (transition === 'dispose') scope.stop()
    else {
      sessionId.value = 'session-two'
      sessionId.value = 'session-one'
    }
    const expected = [{ threadId: 'target', title: 'Current context' }]
    model.threads.value = expected.map(thread => ({ ...thread }))
    model.activeThreadId.value = 'current-thread'
    pending.resolve({ data: { threadId: 'late-thread', title: 'Late response' } })
    await request
    expect(model.threads.value).toEqual(expected)
    expect(model.activeThreadId.value).toBe('current-thread')
    expect(showError).not.toHaveBeenCalled()
  })

  it('stops loading and discards a pending thread list on disposal', async () => {
    const { model, scope } = scopedThreads()
    const pending = deferred()
    nodeAiThreadListApi.mockReturnValueOnce(pending.promise)
    const request = model.fetchThreads()
    expect(model.loading.value).toBe(true)
    scope.stop()
    expect(model.loading.value).toBe(false)
    pending.resolve({ data: { threads: [{ threadId: 'late' }], activeThreadId: 'late' } })
    await request
    expect(model.threads.value).toEqual([])
    expect(model.activeThreadId.value).toBeNull()
  })

  it('treats late history errors as stale results instead of rejecting into a disposed view', async () => {
    const { model, scope } = scopedThreads()
    const pending = deferred()
    nodeAiThreadMessagesApi.mockReturnValueOnce(pending.promise)
    const request = model.loadMessages('thread-one')
    scope.stop()
    pending.reject(new Error('late history failed'))
    await expect(request).resolves.toEqual({ messages: [], nextBeforeSequence: null, hasMore: false, stale: true })
    expect(showError).not.toHaveBeenCalled()
  })

  it('invalidates history across an A-B-A session transition without clearing caller-owned selection', async () => {
    const { model, sessionId } = scopedThreads()
    model.activeThreadId.value = 'previous-thread'
    const pending = deferred()
    nodeAiThreadMessagesApi.mockReturnValueOnce(pending.promise)
    const request = model.loadMessages('thread-one')
    sessionId.value = 'session-two'
    expect(model.activeThreadId.value).toBe('previous-thread')
    sessionId.value = 'session-one'
    pending.resolve({ data: { messages: [], hasMore: false, nextBeforeSequence: null } })
    expect(await request).toMatchObject({ stale: true })
  })
})
