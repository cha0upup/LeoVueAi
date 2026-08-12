import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { previewFileChunkApi } from '@/services/api.js'
import { useLargeFile } from './useLargeFile.js'

vi.mock('@/services/api.js', () => ({
  previewFileChunkApi: vi.fn()
}))

function deferred() {
  let resolve
  const promise = new Promise(res => { resolve = res })
  return { promise, resolve }
}

describe('useLargeFile', () => {
  beforeEach(() => vi.clearAllMocks())

  it('ignores an initialization response after reset', async () => {
    const pending = deferred()
    previewFileChunkApi.mockReturnValueOnce(pending.promise)
    const largeFile = useLargeFile({
      decodeBase64ToString: value => atob(value),
      currentEncoding: ref('utf-8')
    })
    const request = largeFile.initLargeFileMode({ size: 1024 }, 's', '/large.log')

    largeFile.resetLargeFile()
    pending.resolve({ data: { data: btoa('stale'), size: 1024, nextOffset: 5 } })

    expect(await request).toBeNull()
    expect(largeFile.isLargeFileMode.value).toBe(false)
    expect(largeFile.loadedOffset.value).toBe(0)
  })
})
