import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import { deferred } from '@/test-support/deferred.js'
import { useProxyListener } from './useProxyListener.js'

vi.mock('@/utils/errorHandler.js', () => ({ handleError: error => error.message }))
vi.mock('@/utils/messageUtils.js', () => ({ showSuccess: vi.fn(), showWarning: vi.fn() }))

describe('proxy listener current statistics contract', () => {
  let app
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    app?.unmount()
    vi.useRealTimers()
  })

  function fixture(data = { connectionCount: 120, activeConnections: 2, connections: [] }) {
    const api = {
      status: vi.fn().mockResolvedValue({ data: { running: true } }),
      statistics: vi.fn().mockResolvedValue({ data }),
      start: vi.fn(), stop: vi.fn()
    }
    const sessionId = ref('session-one')
    const emit = vi.fn()
    let view
    const renderer = createTestRenderer()
    app = renderer.createApp({
      setup() {
        view = useProxyListener({ sessionId: () => sessionId.value, emit, label: 'HTTP',
          defaultPort: 8080, statusField: 'running', api })
        return () => null
      }
    })
    app.mount(renderer.root)
    return { api, view, sessionId, emit }
  }

  it('uses the total detail count rather than active connections for pagination', async () => {
    const { api, view } = fixture()
    await view.fetchStatistics()
    view.connectionPage.value = 3
    await view.fetchStatistics()
    expect(view.connectionPage.value).toBe(3)
    expect(api.statistics).toHaveBeenLastCalledWith({ sessionId: 'session-one',
      includeConnections: true, page: 3, pageSize: 50 })
    expect(view.status.value).toBe('running')
  })

  it.each([
    { activeConnections: 120, connections: [] },
    { connectionCount: -1, connections: [] },
    { connectionCount: '120', connections: [] },
    { connectionCount: 120 }
  ])('surfaces malformed statistics instead of guessing their shape: %j', async data => {
    const { view } = fixture(data)
    await view.fetchStatistics()
    expect(view.status.value).toBe('error')
    expect(view.errorMessage.value).toBe('代理统计响应格式异常')
    expect(view.statistics.value).toBeNull()
  })

  it('keeps cached details during summary polling and clears them when the total reaches zero', async () => {
    const rows = [{ connId: 'connection-one' }]
    const { api, view } = fixture({ connectionCount: 1, activeConnections: 1, connections: rows })
    await view.fetchStatistics()
    api.statistics.mockResolvedValue({ data: { connectionCount: 1, activeConnections: 0 } })
    view.detailsVisible.value = false
    await view.fetchStatistics()
    expect(api.statistics).toHaveBeenLastCalledWith(expect.objectContaining({ includeConnections: false }))
    expect(view.statistics.value.connections).toEqual(rows)
    api.statistics.mockResolvedValue({ data: { connectionCount: 0, activeConnections: 0 } })
    await view.fetchStatistics()
    expect(view.statistics.value.connections).toEqual([])
  })

  it('shares inflight refreshes and ignores a result arriving after disposal', async () => {
    const { api, view } = fixture()
    await view.fetchStatistics()
    const pending = deferred()
    api.statistics.mockReturnValueOnce(pending.promise)
    const first = view.fetchStatistics()
    expect(view.fetchStatistics()).toBe(first)
    await Promise.resolve()
    const previous = view.statistics.value
    app.unmount()
    app = null
    pending.resolve({ data: { connectionCount: 0, connections: [] } })
    await first
    expect(view.statistics.value).toBe(previous)
    expect(vi.getTimerCount()).toBe(0)
  })
})
