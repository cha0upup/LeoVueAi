import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { previewFileApi } from '@/services/api.js'
import { useFileLoader } from './useFileLoader.js'

vi.mock('@/services/api.js', () => ({
  previewFileApi: vi.fn()
}))

function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function encode(value) {
  return btoa(value)
}

function createLoader() {
  const currentEncoding = ref('utf-8')
  const originalEncoding = ref('utf-8')
  return useFileLoader({
    currentEncoding,
    originalEncoding,
    decodeBase64ToString: value => atob(value),
    detectEncoding: () => 'utf-8'
  })
}

describe('useFileLoader', () => {
  beforeEach(() => vi.clearAllMocks())

  it('keeps the newest overlapping preview response', async () => {
    const first = deferred()
    const second = deferred()
    previewFileApi.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const loader = createLoader()

    const firstLoad = loader.loadFile('s', '/first.txt')
    const secondLoad = loader.loadFile('s', '/second.txt')
    second.resolve({ data: { data: encode('second') } })
    await secondLoad
    first.resolve({ data: { data: encode('first') } })

    expect(await firstLoad).toBeNull()
    expect(loader.fileContent.value).toBe('second')
    expect(loader.originalContent.value).toBe('second')
  })

  it('invalidates a pending response when state is reset', async () => {
    const pending = deferred()
    previewFileApi.mockReturnValueOnce(pending.promise)
    const loader = createLoader()
    const request = loader.loadFile('s', '/file.txt')

    loader.resetFileState()
    pending.resolve({ data: { data: encode('stale') } })

    expect(await request).toBeNull()
    expect(loader.fileContent.value).toBe('')
  })
})
