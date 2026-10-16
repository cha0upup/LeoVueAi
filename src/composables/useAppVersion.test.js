import { beforeEach, describe, expect, it, vi } from 'vitest'
import http from '@/services/http.js'
import { formatDate } from '@/utils/format.js'
import { useAppVersion } from './useAppVersion.js'

vi.mock('@/services/http.js', () => ({ default: { get: vi.fn() } }))
beforeEach(() => vi.resetAllMocks())

describe('running server version', () => {
  it.each(['4.2.1-rc.2+fixture', 'v4.2.1-rc.2+fixture'])('uses server metadata for %s', async version => {
    const buildTime = '2026-10-16T01:02:03Z'
    http.get.mockResolvedValue({ data: { version, buildTime } })
    const state = useAppVersion()
    expect(state.versionLabel.value).toBe('版本…')
    await state.loadVersion()
    expect(http.get).toHaveBeenCalledExactlyOnceWith('/platform/application/info', { timeout: 5000 })
    expect(state.versionLabel.value).toBe('v4.2.1-rc.2+fixture')
    expect(state.versionTooltip.value).toBe(`服务端版本：${version}\n构建时间：${formatDate(buildTime)}（本地时间）`)
  })

  it('does not invent a version or build time when metadata is missing', async () => {
    http.get.mockResolvedValue({ data: { version: null, buildTime: null } })
    const state = useAppVersion()
    await state.loadVersion()
    expect(state.versionLabel.value).toBe('版本未知')
    expect(state.versionTooltip.value).toBe('服务端版本：未记录\n构建时间：未记录')
  })

  it('keeps metadata failures local to the header', async () => {
    http.get.mockRejectedValue(new Error('offline'))
    const state = useAppVersion()
    await expect(state.loadVersion()).resolves.toBeUndefined()
    expect(state.versionLabel.value).toBe('版本未知')
    expect(state.versionTooltip.value).toContain('请刷新后重试')
  })

  it('treats an HTML route response as unavailable metadata', async () => {
    http.get.mockResolvedValue({ data: '<!doctype html><html></html>' })
    const state = useAppVersion()
    await state.loadVersion()
    expect(state.versionLabel.value).toBe('版本未知')
    expect(state.versionTooltip.value).toContain('请刷新后重试')
  })
})
