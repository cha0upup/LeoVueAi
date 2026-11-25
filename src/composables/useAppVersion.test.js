import { beforeEach, describe, expect, it, vi } from 'vitest'
import http from '@/services/http.js'
import { formatDate } from '@/utils/format.js'
import { useAppVersion } from './useAppVersion.js'

vi.mock('@/services/http.js', () => ({ default: { get: vi.fn() } }))
beforeEach(() => vi.resetAllMocks())

describe('running server version', () => {
  it('updates running-server metadata without duplicating an existing version prefix', async () => {
    const version = '4.2.1-rc.2+fixture'
    const buildTime = '2026-10-16T01:02:03Z'
    http.get.mockResolvedValueOnce({ data: { version, buildTime } })
      .mockResolvedValueOnce({ data: { version: 'v4.2.2', buildTime: null } })
    const state = useAppVersion()
    expect(state.versionLabel.value).toBe('版本…')
    await state.loadVersion()
    expect(http.get).toHaveBeenCalledExactlyOnceWith('/platform/application/info', { timeout: 5000 })
    expect(state.versionLabel.value).toBe('v4.2.1-rc.2+fixture')
    expect(state.versionTooltip.value).toBe(`服务端版本：${version}\n构建时间：${formatDate(buildTime)}（本地时间）`)

    await state.loadVersion()
    expect(state.versionLabel.value).toBe('v4.2.2')
    expect(state.versionTooltip.value).toBe('服务端版本：v4.2.2\n构建时间：未记录')
  })

  it('does not invent a version or build time when metadata is missing', async () => {
    http.get.mockResolvedValue({ data: { version: null, buildTime: null } })
    const state = useAppVersion()
    await state.loadVersion()
    expect(state.versionLabel.value).toBe('版本未知')
    expect(state.versionTooltip.value).toBe('服务端版本：未记录\n构建时间：未记录')
  })

  it('clears stale metadata without failing the workspace when the endpoint is unavailable', async () => {
    const state = useAppVersion()
    for (const read of [
      async () => ({ data: '<!doctype html><html></html>' }),
      async () => { throw new Error('offline') }
    ]) {
      http.get.mockResolvedValueOnce({ data: { version: '4.2.1' } }).mockImplementationOnce(read)
      await state.loadVersion()
      expect(state.versionLabel.value).toBe('v4.2.1')

      await expect(state.loadVersion()).resolves.toBeUndefined()
      expect(state.versionLabel.value).toBe('版本未知')
      expect(state.versionTooltip.value).toContain('请刷新后重试')
    }
  })
})
