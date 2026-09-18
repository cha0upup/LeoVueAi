import { deferred } from '@/test-support/deferred.js'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { previewFileChunkApi } from '@/services/api.js'
import { useLargeFile } from './useLargeFile.js'

vi.mock('@/services/api.js', () => ({
  previewFileChunkApi: vi.fn()
}))

describe('useLargeFile', () => {
  beforeEach(() => vi.clearAllMocks())

  it('ignores an initialization response after reset', async () => {
    const pending = deferred()
    previewFileChunkApi.mockReturnValueOnce(pending.promise)
    const largeFile = useLargeFile({
      currentEncoding: ref('utf-8')
    })
    const request = largeFile.initLargeFileMode({ size: 1024 }, 's', '/large.log')

    largeFile.resetLargeFile()
    pending.resolve({ data: { data: btoa('stale'), size: 1024, nextOffset: 5 } })

    expect(await request).toBeNull()
    expect(largeFile.isLargeFileMode.value).toBe(false)
    expect(largeFile.loadedOffset.value).toBe(0)
  })
  it('decodes Chinese and emoji split across multiple chunks without replacement characters', async () => {
    const bytes = new TextEncoder().encode('中😀文')
    const base64 = (bytes) => btoa(String.fromCharCode(...bytes))
    const largeFile = useLargeFile({ currentEncoding: ref('utf-8') })
    let content = await largeFile.initLargeFileMode(
      { size: bytes.length, data: base64(bytes.slice(0, 1)), nextOffset: 1 },
      's',
      '/file'
    )
    const model = {
      getLineCount: () => 1,
      getLineMaxColumn: () => content.length + 1,
      applyEdits: (edits) => {
        content += edits[0].text
      }
    }
    for (let offset = 1; offset < bytes.length; offset++) {
      previewFileChunkApi.mockResolvedValueOnce({
        data: {
          data: base64(bytes.slice(offset, offset + 1)),
          nextOffset: offset + 1
        }
      })
      await largeFile.loadNextChunk('s', '/file', () => ({ getModel: () => model }))
    }
    expect(content).toBe('中😀文')
    expect(largeFile.loadedOffset.value).toBe(bytes.length)
  })

  it('does not consume a partial character while the editor is unavailable', async () => {
    const largeFile = useLargeFile({ currentEncoding: ref('utf-8') })
    await largeFile.initLargeFileMode({ size: 3, data: btoa('\xe4'), nextOffset: 1 }, 's', '/file')
    previewFileChunkApi.mockResolvedValue({ data: { data: btoa('\xb8\xad'), nextOffset: 3 } })
    await largeFile.loadNextChunk('s', '/file', () => null)
    expect(largeFile.loadedOffset.value).toBe(1)
    const applyEdits = vi.fn()
    await largeFile.loadNextChunk('s', '/file', () => ({
      getModel: () => ({
        getLineCount: () => 1,
        getLineMaxColumn: () => 1,
        applyEdits
      })
    }))
    expect(applyEdits.mock.calls[0][0][0].text).toBe('中')
    expect(largeFile.loadedOffset.value).toBe(3)
  })
})
