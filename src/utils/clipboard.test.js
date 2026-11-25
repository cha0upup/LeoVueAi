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
  it('reads the original content once and reports success only after the clipboard write completes', async () => {
    const pending = deferred()
    writeText.mockReturnValue(pending.promise)
    const text = '  中文\n多行  '
    const read = vi.fn(() => text)
    const copy = copyTextWithFeedback(read, '已复制目录路径')
    expect(read).toHaveBeenCalledOnce()
    expect(writeText).toHaveBeenCalledExactlyOnceWith(text)
    expect(showSuccess).not.toHaveBeenCalled()
    pending.resolve()
    await copy
    expect(showSuccess).toHaveBeenCalledExactlyOnceWith('已复制目录路径')
    expect(showError).not.toHaveBeenCalled()
  })

  it.each(['write', 'prepare'])('preserves custom failure feedback when %s fails', async failure => {
    writeText.mockRejectedValue(new Error('denied'))
    const source = failure === 'prepare' ? () => { throw new Error('invalid data') } : 'code'
    await copyTextWithFeedback(source, 'copied', '复制失败，请手动选择复制')
    expect(writeText).toHaveBeenCalledTimes(failure === 'prepare' ? 0 : 1)
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
