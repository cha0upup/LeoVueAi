import { describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { deferred } from '@/test-support/deferred.js'
import { useAiHistory } from './useAiHistory.js'

const record = sequence => ({ messageId: `message-${sequence}`, sequence })

describe('shared AI history state', () => {
  it('retries the same cursor without duplicate loads and preserves scroll position', async () => {
    const { promise, resolve } = deferred()
    const wrap = { scrollHeight: 100, scrollTop: 10 }
    const onPrepend = vi.fn(() => { wrap.scrollHeight = 180 })
    const failure = new Error('offline')
    const onError = vi.fn()
    const loadPage = vi.fn().mockRejectedValueOnce(failure).mockReturnValueOnce(promise)
    const history = useAiHistory({
      getConversationKey: () => 'thread-1', getScopeKey: () => 'session-1', loadPage, onPrepend,
      getScrollElement: () => wrap, onError
    })
    const current = { ...record(3), content: 'current reply' }
    history.recordPage('thread-1', { messages: [current], hasMore: true, nextBeforeSequence: 3 })
    expect(await history.loadOlderMessages()).toBe(false)
    expect(onError).toHaveBeenCalledExactlyOnceWith(failure)
    expect(history.hasOlderMessages.value).toBe(true)
    expect(history.loadingOlder.value).toBe(false)

    const loading = history.loadOlderMessages()
    expect(history.loadingOlder.value).toBe(true)
    expect(await history.loadOlderMessages()).toBe(false)
    resolve({ messages: [record(1), record(2), { ...record(3), content: 'older copy' }], hasMore: false, nextBeforeSequence: 1 })
    expect(await loading).toBe(true)
    expect(loadPage).toHaveBeenCalledTimes(2)
    expect(loadPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ threadId: 'thread-1', scopeKey: 'session-1', beforeSequence: 3, limit: 50 }),
      { signal: expect.objectContaining({ aborted: false }) })
    expect(loadPage.mock.calls[1][0]).toEqual(loadPage.mock.calls[0][0])
    expect(onPrepend).toHaveBeenCalledExactlyOnceWith([record(1), record(2), current], 'thread-1')
    expect(wrap.scrollTop).toBe(90)
    expect(history.hasOlderMessages.value).toBe(false)
    expect(history.loadingOlder.value).toBe(false)
  })

  it('cancels older history when leaving the conversation scope', async () => {
    const { promise, resolve } = deferred()
    const retry = deferred()
    const session = ref('session-1')
    const onPrepend = vi.fn()
    const loadPage = vi.fn().mockReturnValueOnce(promise).mockReturnValueOnce(retry.promise)
    const scope = effectScope()
    try {
      const history = scope.run(() => useAiHistory({
        getConversationKey: () => 'thread-1', getScopeKey: () => session.value,
        loadPage, onPrepend
      }))
      history.recordPage('thread-1', { messages: [record(3)], hasMore: true, nextBeforeSequence: 3 })
      const loading = history.loadOlderMessages()
      expect(loadPage).toHaveBeenCalledOnce()
      session.value = 'session-2'
      expect(loadPage.mock.lastCall[1]?.signal.aborted).toBe(true)
      session.value = 'session-1'
      expect(history.loadingOlder.value).toBe(false)
      const next = history.loadOlderMessages()
      resolve({ messages: [record(1)], hasMore: false, nextBeforeSequence: 1 })
      expect(await loading).toBe(false)
      expect(onPrepend).not.toHaveBeenCalled()
      expect(history.loadingOlder.value).toBe(true)
      retry.resolve({ messages: [record(2)], hasMore: false, nextBeforeSequence: 2 })
      expect(await next).toBe(true)
      expect(onPrepend).toHaveBeenCalledExactlyOnceWith([record(2), record(3)], 'thread-1')
    } finally {
      scope.stop()
    }
  })

  it('ignores an obsolete error after the same conversation gets a new history page', async () => {
    const request = deferred()
    const onError = vi.fn()
    const history = useAiHistory({
      getConversationKey: () => 'thread-1', loadPage: () => request.promise,
      onPrepend: vi.fn(), onError
    })
    history.recordPage('thread-1', { messages: [record(3)], hasMore: true, nextBeforeSequence: 3 })
    const loading = history.loadOlderMessages()
    history.recordPage('thread-1', { messages: [record(5)], hasMore: false, nextBeforeSequence: 5 })
    request.reject(new Error('obsolete page error'))
    expect(await loading).toBe(false)
    expect(onError).not.toHaveBeenCalled()
    expect(history.hasOlderMessages.value).toBe(false)
  })
})
