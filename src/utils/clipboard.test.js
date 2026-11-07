import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deferred } from '@/test-support/deferred.js'
import { copyTextWithFeedback } from './clipboard.js'
import { showError, showSuccess } from './messageUtils.js'

vi.mock('./messageUtils.js', () => ({ showError: vi.fn(), showSuccess: vi.fn() }))

const writeText = vi.fn()
beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { clipboard: { writeText } })
})
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('copyTextWithFeedback', () => {
  it('preserves content and only reports success after the clipboard write completes', async () => {
    const pending = deferred()
    writeText.mockReturnValue(pending.promise)
    const text = '  中文\n多行  '
    const copy = copyTextWithFeedback(text, '已复制目录路径')
    expect(writeText).toHaveBeenCalledExactlyOnceWith(text)
    expect(showSuccess).not.toHaveBeenCalled()
    pending.resolve()
    await copy
    expect(showSuccess).toHaveBeenCalledExactlyOnceWith('已复制目录路径')
    expect(showError).not.toHaveBeenCalled()
  })

  it('preserves custom failure messages without emitting success', async () => {
    writeText.mockRejectedValue(new Error('denied'))
    await copyTextWithFeedback('code', 'copied', '复制失败，请手动选择复制')
    expect(showError).toHaveBeenCalledExactlyOnceWith('复制失败，请手动选择复制')
    expect(showSuccess).not.toHaveBeenCalled()
  })

  it('reports unavailable clipboard APIs without throwing or emitting success', async () => {
    vi.stubGlobal('navigator', {})
    await expect(copyTextWithFeedback('content')).resolves.toBeUndefined()
    expect(showError).toHaveBeenCalledExactlyOnceWith('复制失败，请手动复制')
    expect(showSuccess).not.toHaveBeenCalled()
  })
})
