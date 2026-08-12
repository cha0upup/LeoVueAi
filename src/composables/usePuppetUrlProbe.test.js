import { describe, expect, it, vi } from 'vitest'

vi.mock('@/services/api.js', () => ({ probeUrlPathsApi: vi.fn() }))

import { usePuppetUrlProbe } from './usePuppetUrlProbe.js'

const createMessages = () => ({
  error: vi.fn(),
  info: vi.fn(),
  success: vi.fn(),
  warning: vi.fn()
})

describe('usePuppetUrlProbe', () => {
  it('validates the base URL before requesting', async () => {
    const messages = createMessages()
    const probeApi = vi.fn()
    const probe = usePuppetUrlProbe({
      getBaseUrl: () => '   ',
      mergePaths: vi.fn(),
      probeApi,
      messages
    })

    await expect(probe.probePaths()).resolves.toBe(false)
    expect(probeApi).not.toHaveBeenCalled()
    expect(messages.warning).toHaveBeenCalledWith('请先填写连接地址')
  })

  it('merges successful results and reports their sources', async () => {
    const messages = createMessages()
    const mergePaths = vi.fn()
    const probe = usePuppetUrlProbe({
      getBaseUrl: () => ' https://example.test ',
      mergePaths,
      probeApi: vi.fn().mockResolvedValue({
        data: { success: true, paths: ['/one', '/two'], sources: ['robots', 'sitemap'] }
      }),
      messages
    })

    await expect(probe.probePaths()).resolves.toBe(true)
    expect(mergePaths).toHaveBeenCalledWith(['/one', '/two'])
    expect(messages.success).toHaveBeenCalledWith(
      '探测完成，发现 2 个路径（来源：robots、sitemap）'
    )
    expect(probe.probing.value).toBe(false)
  })

  it('ignores a response after the dialog invalidates the request', async () => {
    let resolveRequest
    const request = new Promise((resolve) => {
      resolveRequest = resolve
    })
    const messages = createMessages()
    const mergePaths = vi.fn()
    const probe = usePuppetUrlProbe({
      getBaseUrl: () => 'https://example.test',
      mergePaths,
      probeApi: () => request,
      messages
    })

    const pending = probe.probePaths()
    expect(probe.probing.value).toBe(true)
    probe.cancelProbe()
    resolveRequest({ data: { success: true, paths: ['/stale'] } })

    await expect(pending).resolves.toBe(false)
    expect(mergePaths).not.toHaveBeenCalled()
    expect(messages.success).not.toHaveBeenCalled()
    expect(probe.probing.value).toBe(false)
  })
})
