import { describe, expect, it, vi } from 'vitest'
import { useAiHistory } from './useAiHistory.js'

const record = sequence => ({ messageId: `message-${sequence}`, sequence })

describe('shared AI history state', () => {
  it('prepends previous pages, serializes duplicate clicks and preserves scroll position', async () => {
    let resolve
    const wrap = { scrollHeight: 100, scrollTop: 10 }
    const onPrepend = vi.fn(() => { wrap.scrollHeight = 180 })
    const loadPage = vi.fn(() => new Promise(done => { resolve = done }))
    const history = useAiHistory({
      getConversationKey: () => 'thread-1', getScopeKey: () => 'session-1', loadPage, onPrepend,
      getScrollElement: () => wrap
    })
    history.recordPage('thread-1', { messages: [record(3)], hasMore: true, nextBeforeSequence: 3 })
    const loading = history.loadOlderMessages()
    expect(history.loadingOlder.value).toBe(true)
    expect(await history.loadOlderMessages()).toBe(false)
    resolve({ messages: [record(1), record(2)], hasMore: false, nextBeforeSequence: 1 })
    expect(await loading).toBe(true)
    expect(loadPage).toHaveBeenCalledTimes(1)
    expect(loadPage).toHaveBeenCalledWith(expect.objectContaining({ threadId: 'thread-1', scopeKey: 'session-1', beforeSequence: 3, limit: 50 }))
    expect(onPrepend).toHaveBeenCalledWith([record(1), record(2), record(3)], 'thread-1')
    expect(wrap.scrollTop).toBe(90)
    expect(history.hasOlderMessages.value).toBe(false)
    expect(history.loadingOlder.value).toBe(false)
  })

  it('discards stale pages after switching thread or node session', async () => {
    let resolve
    let scope = 'session-1'
    const onPrepend = vi.fn()
    const history = useAiHistory({
      getConversationKey: () => 'thread-1', getScopeKey: () => scope,
      loadPage: () => new Promise(done => { resolve = done }), onPrepend
    })
    history.recordPage('thread-1', { messages: [record(3)], hasMore: true, nextBeforeSequence: 3 })
    const loading = history.loadOlderMessages()
    scope = 'session-2'
    resolve({ messages: [record(1)], hasMore: false, nextBeforeSequence: 1 })
    expect(await loading).toBe(false)
    expect(onPrepend).not.toHaveBeenCalled()
    expect(history.hasOlderMessages.value).toBe(false)
  })

  it('keeps pagination retryable on request failures', async () => {
    const onError = vi.fn()
    const history = useAiHistory({
      getConversationKey: () => 'thread-1', loadPage: vi.fn().mockRejectedValue(new Error('offline')),
      onPrepend: vi.fn(), onError
    })
    history.recordPage('thread-1', { messages: [record(3)], hasMore: true, nextBeforeSequence: 3 })
    expect(await history.loadOlderMessages()).toBe(false)
    expect(history.hasOlderMessages.value).toBe(true)
    expect(history.loadingOlder.value).toBe(false)
    expect(onError).toHaveBeenCalledOnce()
  })
})
