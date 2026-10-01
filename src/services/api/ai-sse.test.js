import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deferred } from '@/test-support/deferred.js'
import { configureHttpErrorHandling } from '../httpErrorHandling.js'
import { registerSessionCleanup, resetSessionState } from '../sessionLifecycle.js'
import { fetchAiSse, parseAiSseStream } from './ai-sse.js'

const completedStream = ending => [
  'id: 1', 'event: turn/started', 'data: {"turn":{"id":"turn-1"}}', '',
  'id: 2', 'event: turn', 'data: {"content":"你好"}', '',
  'id: 3', 'event: turn/completed', 'data: {"turn":{"status":"completed"}}', '', ''
].join(ending)

describe('AI SSE byte streams', () => {
  it.each(['\n', '\r\n', '\r'])('preserves UTF-8 and control events for %j endings', async ending => {
    const bytes = new TextEncoder().encode(completedStream(ending))
    const body = new globalThis.ReadableStream({
      start(controller) {
        for (const byte of bytes) controller.enqueue(new Uint8Array([byte]))
        controller.close()
      }
    })
    const onTurnCompleted = vi.fn()
    await expect(parseAiSseStream(new globalThis.Response(body), { onTurnCompleted })).resolves.toBe('你好')
    expect(onTurnCompleted).toHaveBeenCalledOnce()
  })

  it('flushes a final data line without a newline', async () => {
    await expect(parseAiSseStream(new globalThis.Response('event: turn\ndata: {"content":"tail"}')))
      .resolves.toBe('tail')
  })

  it.each(['', '{malformed'])('does not advance past an invalid started event: %j', async payload => {
    const onEventSeq = vi.fn()
    await parseAiSseStream(new globalThis.Response(`id: 1\nevent: turn/started\ndata: ${payload}\n\n`), { onEventSeq })
    expect(onEventSeq).not.toHaveBeenCalled()
  })

  it('detects an incomplete new turn after an earlier completed turn', async () => {
    const body = completedStream('\n') + 'event: turn/started\ndata: {"turn":{"id":"turn-2"}}\n\n'
    await expect(parseAiSseStream(new globalThis.Response(body)))
      .rejects.toMatchObject({ code: 'AI_TURN_INCOMPLETE' })
  })

  it('keeps a rejected new started event from inheriting an older terminal marker', async () => {
    const body = completedStream('\n') + 'event: turn/started\ndata: {"turn":{"id":"turn-2"}}\n\n'
    await expect(parseAiSseStream(new globalThis.Response(body), {
      onTurnStarted: entry => {
        if (entry.turn.id === 'turn-2') throw new Error('state update failed')
      }
    })).rejects.toMatchObject({ code: 'AI_TURN_INCOMPLETE' })
  })

  it('cancels the read stream and preserves the cursor when a business handler throws', async () => {
    const cancel = vi.fn()
    const onEventSeq = vi.fn()
    const body = new globalThis.ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('id: 1\nevent: node\ndata: {"kind":"text"}\n\n'))
      },
      cancel
    })
    await expect(parseAiSseStream(new globalThis.Response(body), {
      onNode: () => { throw new Error('state update failed') }, onEventSeq
    })).rejects.toThrow('state update failed')
    expect(onEventSeq).not.toHaveBeenCalled()
    expect(cancel).toHaveBeenCalledOnce()
  })
})

describe('AI SSE HTTP and session lifecycle', () => {
  const replaceRoute = vi.fn(async () => {})
  const cleanup = vi.fn()
  let unregister

  beforeEach(() => {
    resetSessionState()
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    unregister = registerSessionCleanup('sse-test', cleanup)
    configureHttpErrorHandling({
      getCurrentRoute: () => ({ path: '/main', fullPath: '/main?tab=ai' }),
      replaceRoute
    })
  })

  afterEach(() => {
    unregister()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it.each([401, 200])('uses the shared login reset for a %i response with a 401 envelope', async status => {
    vi.stubGlobal('fetch', vi.fn(async () => new globalThis.Response(
      JSON.stringify({ code: 401, msg: 'session expired' }),
      { status, headers: { 'Content-Type': 'application/json' } }
    )))
    await expect(fetchAiSse('/events', {})).rejects.toMatchObject({
      code: 401, message: 'session expired', response: { status }
    })
    expect(cleanup).toHaveBeenCalledOnce()
    expect(replaceRoute).toHaveBeenCalledWith({ path: '/login', query: { redirect: '/main?tab=ai' } })
  })

  it('keeps structured errors and routes a forced-password response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new globalThis.Response(
      JSON.stringify({ code: 403, msg: 'change password', data: { passwordChangeRequired: true } }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    )))
    await expect(fetchAiSse('/events', {})).rejects.toMatchObject({
      code: 403, response: { data: { data: { passwordChangeRequired: true } } }
    })
    expect(replaceRoute).toHaveBeenCalledWith('/change-password')
    expect(cleanup).not.toHaveBeenCalled()
  })

  it('retains the transport status for non-JSON failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new globalThis.Response('upstream unavailable', { status: 503 })))
    await expect(fetchAiSse('/events', {})).rejects.toMatchObject({ code: 503, message: 'upstream unavailable' })
    expect(replaceRoute).not.toHaveBeenCalled()
  })

  it('ignores a late 401 from the old login', async () => {
    const response = deferred()
    vi.stubGlobal('fetch', vi.fn(() => response.promise))
    const result = fetchAiSse('/events', {})
    const assertion = expect(result).rejects.toMatchObject({ code: 'SESSION_CHANGED' })
    resetSessionState()
    cleanup.mockClear()
    response.resolve(new globalThis.Response('{"code":401}', { status: 401 }))
    await assertion
    expect(cleanup).not.toHaveBeenCalled()
    expect(replaceRoute).not.toHaveBeenCalled()
  })

  it('aborts a pending subscription on session reset without a backend stop request', async () => {
    const fetch = vi.fn((url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
    }))
    vi.stubGlobal('fetch', fetch)
    const result = fetchAiSse('/events', {})
    const assertion = expect(result).rejects.toMatchObject({ code: 'SESSION_CHANGED' })
    resetSessionState()
    await assertion
    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(true)
  })

  it('forwards caller cancellation and unregisters completed subscriptions', async () => {
    const controller = new AbortController()
    const removeListener = vi.spyOn(controller.signal, 'removeEventListener')
    let requestSignal
    vi.stubGlobal('fetch', vi.fn(async (url, { signal }) => {
      requestSignal = signal
      return new globalThis.Response(completedStream('\n'))
    }))
    await expect(fetchAiSse('/events', {}, controller.signal)).resolves.toBe('你好')
    expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function))
    resetSessionState()
    expect(requestSignal.aborted).toBe(false)
  })

  it('forwards an abort from the caller without changing login state', async () => {
    const controller = new AbortController()
    vi.stubGlobal('fetch', vi.fn((url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => {
        const error = new Error('caller aborted')
        error.name = 'AbortError'
        reject(error)
      }, { once: true })
    })))
    const request = fetchAiSse('/events', {}, controller.signal)
    const assertion = expect(request).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    await assertion
    expect(cleanup).not.toHaveBeenCalled()
    expect(replaceRoute).not.toHaveBeenCalled()
  })
})
