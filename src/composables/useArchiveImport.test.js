import { deferred } from '@/test-support/deferred.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ handleError: vi.fn(), showSuccess: vi.fn() }))

vi.mock('@/utils/errorHandler.js', () => ({ handleError: mocks.handleError }))
vi.mock('@/utils/messageUtils.js', () => ({ showSuccess: mocks.showSuccess }))

import { useArchiveImport } from './useArchiveImport.js'

const createFile = (name = 'items.zip') => new File(['archive'], name)

beforeEach(() => vi.clearAllMocks())

describe('useArchiveImport', () => {
  it('does not submit until a file is selected, or after it is removed', async () => {
    const request = vi.fn()
    const onImported = vi.fn()
    const importer = useArchiveImport({ request, onImported })

    await importer.submit()
    importer.handleFileChange({ raw: createFile() })
    importer.handleFileRemove()
    await importer.submit()

    expect(request).not.toHaveBeenCalled()
    expect(onImported).not.toHaveBeenCalled()
    expect(importer.selectedFile.value).toBeNull()
    expect(importer.submitting.value).toBe(false)
    expect(importer.step.value).toBe('pick')
  })

  it('submits the selected file and policy once, then forwards the same form to completion', async () => {
    const pending = deferred()
    let scope = 'platform'
    const request = vi.fn(formData => {
      formData.append('scope', scope)
      return pending.promise
    })
    const onImported = vi.fn()
    const importer = useArchiveImport({ request, onImported })
    const file = createFile()
    importer.handleFileChange({ raw: file })
    importer.conflictPolicy.value = 'rename'

    const submission = importer.submit()
    scope = 'changed'
    await importer.submit()
    expect(importer.submitting.value).toBe(true)
    expect(request).toHaveBeenCalledTimes(1)
    const [formData] = request.mock.calls[0]
    expect(formData.get('file')).toBe(file)
    expect(formData.get('conflictPolicy')).toBe('rename')
    expect(formData.get('scope')).toBe('platform')
    expect(onImported).not.toHaveBeenCalled()

    const results = [{ status: 'imported', name: 'one' }]
    pending.resolve({ data: { results } })
    await submission

    expect(importer.results.value).toEqual(results)
    expect(importer.step.value).toBe('result')
    expect(importer.submitting.value).toBe(false)
    expect(onImported).toHaveBeenCalledExactlyOnceWith(results, formData)
    expect(onImported.mock.lastCall[1]).toBe(formData)
  })

  it('counts partial outcomes and clears the results and uploader for the next import', async () => {
    const results = [
      { status: 'imported' }, { status: 'imported' }, { status: 'overwritten' },
      { status: 'renamed', originalName: 'old', finalName: 'new' },
      { status: 'skipped' }, { status: 'failed', message: 'bad archive' },
      { status: 'unknown', message: 'unrecognized result' }
    ]
    const importer = useArchiveImport({
      request: vi.fn().mockResolvedValue({ data: { results } }), onImported: vi.fn()
    })
    const clearFiles = vi.fn()
    importer.uploadRef.value = { clearFiles }
    importer.handleFileChange({ raw: createFile() })
    importer.conflictPolicy.value = 'overwrite'
    await importer.submit()

    expect(importer.counts.value).toEqual({
      imported: 2, overwritten: 1, renamed: 1, skipped: 1, failed: 1
    })
    expect(importer.results.value).toEqual(results)
    expect(importer.statusText('renamed')).toBe('已重命名')
    expect(importer.statusText('unknown')).toBe('unknown')
    expect(mocks.handleError).not.toHaveBeenCalled()

    importer.reset()
    expect(importer.selectedFile.value).toBeNull()
    expect(importer.conflictPolicy.value).toBe('skip')
    expect(importer.step.value).toBe('pick')
    expect(importer.results.value).toEqual([])
    expect(importer.counts.value.imported).toBe(0)
    expect(clearFiles).toHaveBeenCalledExactlyOnceWith()
  })

  it('keeps the file and policy after a request fails so the user can retry', async () => {
    const failure = new Error('import failed')
    const request = vi.fn().mockRejectedValueOnce(failure).mockResolvedValue({ data: { results: [] } })
    const onImported = vi.fn()
    const importer = useArchiveImport({ request, onImported })
    const file = createFile()
    importer.handleFileChange({ raw: file })
    importer.conflictPolicy.value = 'overwrite'

    await importer.submit()

    expect(importer.selectedFile.value).toBe(file)
    expect(importer.conflictPolicy.value).toBe('overwrite')
    expect(importer.step.value).toBe('pick')
    expect(importer.submitting.value).toBe(false)
    expect(onImported).not.toHaveBeenCalled()
    expect(mocks.handleError).toHaveBeenCalledExactlyOnceWith(failure, {
      defaultMessage: '导入失败', defaultMessages: undefined
    })

    await importer.submit()
    expect(request).toHaveBeenCalledTimes(2)
    expect(importer.step.value).toBe('result')
  })

  it('does not restore an old result screen after reset but still refreshes imported data', async () => {
    const pending = deferred()
    const onImported = vi.fn()
    const importer = useArchiveImport({ request: () => pending.promise, onImported })
    importer.handleFileChange({ raw: createFile() })
    const submission = importer.submit()
    importer.reset()
    const nextFile = createFile('next.zip')
    importer.handleFileChange({ raw: nextFile })
    const results = [{ status: 'imported' }]
    pending.resolve({ data: { results } })
    await submission

    expect(importer.step.value).toBe('pick')
    expect(importer.results.value).toEqual([])
    expect(importer.selectedFile.value).toBe(nextFile)
    expect(importer.submitting.value).toBe(false)
    expect(onImported).toHaveBeenCalledExactlyOnceWith(results, expect.any(FormData))
  })
})
