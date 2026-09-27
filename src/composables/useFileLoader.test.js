import { deferred } from '@/test-support/deferred.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { previewFileApi } from '@/services/api.js'
import { useFileLoader } from './useFileLoader.js'
import { useFileEncoding } from './useFileEncoding.js'
import { useFilePreviewRequest } from './useFilePreviewRequest.js'

vi.mock('@/services/api.js', () => ({ previewFileApi: vi.fn() }))
vi.mock('@/utils/messageUtils.js', () => ({ showWarning: vi.fn() }))

const response = (text) => ({ data: { data: btoa(text), size: text.length } })
beforeEach(() => vi.resetAllMocks())

describe('file preview loading', () => {
  it('ignores stale content without ending an ongoing refresh', async () => {
    const stale = deferred()
    const latest = deferred()
    previewFileApi
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValueOnce(response('current'))
      .mockReturnValueOnce(latest.promise)
    const loader = useFileLoader(useFileEncoding())
    const request = useFilePreviewRequest()
    const refresh = () =>
      request.run('refresh', (isCurrent) => loader.loadFile('s', '/file.txt', { isCurrent }))

    const oldLoad = refresh()
    await refresh()
    const newLoad = refresh()
    stale.resolve(response('stale'))
    expect(await oldLoad).toBeNull()
    expect(loader.fileContent.value).toBe('current')
    expect(request.isRefreshing.value).toBe(true)

    latest.resolve(response('latest'))
    await newLoad
    expect(loader.fileContent.value).toBe('latest')
    expect(loader.originalContent.value).toBe('latest')
    expect(request.isRefreshing.value).toBe(false)
  })

  it('invalidates a pending response when file state is reset', async () => {
    const pending = deferred()
    previewFileApi.mockReturnValueOnce(pending.promise)
    const loader = useFileLoader(useFileEncoding())
    const load = loader.loadFile('s', '/file.txt')
    loader.resetFileState()
    pending.resolve(response('stale'))
    expect(await load).toBeNull()
    expect(loader.fileContent.value).toBe('')
  })

  it('ignores a cancelled encoding reload before another fetch begins', async () => {
    const pending = deferred()
    previewFileApi.mockResolvedValueOnce(response('original')).mockReturnValueOnce(pending.promise)
    const encoding = useFileEncoding()
    const loader = useFileLoader(encoding)
    const request = useFilePreviewRequest()
    await loader.loadFile('s', '/file.txt')
    const load = request.run('encoding', (isCurrent) =>
      loader.loadFile('s', '/file.txt', { encoding: 'utf-8-bom', isCurrent })
    )
    request.reset()
    pending.resolve(response('stale'))
    expect(await load).toBeNull()
    expect(loader.fileContent.value).toBe('original')
    expect(encoding.currentEncoding.value).toBe('utf-8')
    expect(request.isEncoding.value).toBe(false)
  })

  it('keeps existing content when an encoding reload returns truncated data', async () => {
    const loader = useFileLoader(useFileEncoding())
    previewFileApi.mockResolvedValueOnce(response('original'))
    await loader.loadFile('s', '/file.txt')
    previewFileApi.mockResolvedValueOnce({ data: { truncated: true, size: 2000000 } })
    await expect(loader.loadFile('s', '/file.txt', { encoding: 'utf-8-bom' })).rejects.toThrow(
      '文件过大'
    )
    expect(loader.fileContent.value).toBe('original')
  })
})
