import { describe, expect, it, vi } from 'vitest'
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
    expect(loadPage).toHaveBeenLastCalledWith(expect.objectContaining({ threadId: 'thread-1', scopeKey: 'session-1', beforeSequence: 3, limit: 50 }))
    expect(loadPage.mock.calls[1]).toEqual(loadPage.mock.calls[0])
    expect(onPrepend).toHaveBeenCalledExactlyOnceWith([record(1), record(2), current], 'thread-1')
    expect(wrap.scrollTop).toBe(90)
    expect(history.hasOlderMessages.value).toBe(false)
    expect(history.loadingOlder.value).toBe(false)
  })

  it('discards stale pages after leaving the current conversation scope', async () => {
    const { promise, resolve } = deferred()
    let scope = 'session-1'
    const onPrepend = vi.fn()
    const loadPage = vi.fn().mockReturnValue(promise)
    const history = useAiHistory({
      getConversationKey: () => 'thread-1', getScopeKey: () => scope,
      loadPage, onPrepend
    })
    history.recordPage('thread-1', { messages: [record(3)], hasMore: true, nextBeforeSequence: 3 })
    const loading = history.loadOlderMessages()
    expect(loadPage).toHaveBeenCalledOnce()
    scope = 'session-2'
    resolve({ messages: [record(1)], hasMore: false, nextBeforeSequence: 1 })
    expect(await loading).toBe(false)
    expect(onPrepend).not.toHaveBeenCalled()
    expect(history.hasOlderMessages.value).toBe(false)
  })
})
