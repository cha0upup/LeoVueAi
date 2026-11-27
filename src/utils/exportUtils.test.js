import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deferred } from '@/test-support/deferred.js'

const mocks = vi.hoisted(() => ({
  downloadBlob: vi.fn(),
  handleError: vi.fn(),
  showSuccess: vi.fn()
}))

vi.mock('./downloadBlob.js', () => ({ downloadBlob: mocks.downloadBlob }))
vi.mock('./errorHandler.js', () => ({ handleError: mocks.handleError }))
vi.mock('./messageUtils.js', () => ({ showSuccess: mocks.showSuccess }))

import { executeBlobDownload, exportXlsx, writeWorkbookSpec } from './exportUtils.js'

beforeEach(() => vi.resetAllMocks())

describe('executeBlobDownload', () => {
  it('downloads the original Blob before reporting success and completing the request', async () => {
    const response = { data: new Blob(['archive']) }
    const loadingRef = ref(false)
    const { promise: pending, resolve: finishRequest } = deferred()
    const request = vi.fn(() => pending)
    const onSuccess = vi.fn(() => {
      expect(mocks.downloadBlob).toHaveBeenCalledExactlyOnceWith(response.data, 'result.zip')
      expect(loadingRef.value).toBe(true)
    })
    const download = executeBlobDownload(request, 'result.zip', {
      loadingRef, successMessage: '导出完成', onSuccess
    })

    expect(loadingRef.value).toBe(true)
    expect(mocks.downloadBlob).not.toHaveBeenCalled()
    expect(mocks.showSuccess).not.toHaveBeenCalled()
    finishRequest(response)

    await expect(download).resolves.toBe(response)
    expect(request).toHaveBeenCalledExactlyOnceWith()
    expect(onSuccess).toHaveBeenCalledExactlyOnceWith(response)
    expect(mocks.showSuccess).toHaveBeenCalledExactlyOnceWith('导出完成')
    expect(loadingRef.value).toBe(false)
  })

  it.each(['request', 'download'])('preserves selection when the %s fails', async (stage) => {
    const failure = new Error('export failed')
    const loadingRef = ref(false)
    const selected = new Set(['a', 'b'])
    const onSuccess = vi.fn(() => selected.clear())
    const request = vi.fn().mockResolvedValue({ data: new Blob(['archive']) })
    if (stage === 'request') request.mockRejectedValue(failure)
    else mocks.downloadBlob.mockImplementation(() => { throw failure })

    await expect(executeBlobDownload(request, 'result.zip', {
      loadingRef, successMessage: '导出完成', onSuccess
    })).rejects.toBe(failure)

    expect([...selected]).toEqual(['a', 'b'])
    expect(onSuccess).not.toHaveBeenCalled()
    expect(mocks.showSuccess).not.toHaveBeenCalled()
    expect(mocks.handleError).toHaveBeenCalledExactlyOnceWith(failure, {
      defaultMessage: '导出失败', defaultMessages: undefined
    })
    expect(loadingRef.value).toBe(false)
    if (stage === 'request') expect(mocks.downloadBlob).not.toHaveBeenCalled()
  })

  it('lets callers handle errors without a duplicate default notification', async () => {
    const failure = new Error('failed')
    const onError = vi.fn()
    await expect(executeBlobDownload(async () => { throw failure }, 'result.zip', {
      errorMessage: null, onError
    })).rejects.toBe(failure)

    expect(onError).toHaveBeenCalledExactlyOnceWith(failure)
    expect(mocks.handleError).not.toHaveBeenCalled()
  })
})

async function readWorkbook(blob) {
  const module = await import('xlsx')
  const xlsx = module.default || module
  return xlsx.read(await blob.arrayBuffer(), { type: 'array' })
}

describe('exportXlsx', () => {
  it('exports explicit columns with typed values and literal text in the workbook', async () => {
    await expect(exportXlsx([{ title: '中文,含引号\n下一行', count: -2, active: false }], 'results', [
      { label: '标题', key: 'title' },
      { label: '数量', key: 'count' },
      { label: '启用', key: row => row.active },
      { label: '备注', key: () => '=备注' },
      { label: '对象', key: () => ({ label: '说明' }) },
      { label: '缺失', key: 'missing' }
    ])).resolves.toBe(true)

    const [blob, filename] = mocks.downloadBlob.mock.calls[0]
    expect(filename).toBe('results.xlsx')
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    const sheet = (await readWorkbook(blob)).Sheets['数据']
    expect(sheet.A2).toMatchObject({ t: 's', v: '中文,含引号\n下一行' })
    expect(sheet.B2).toMatchObject({ t: 'n', v: -2 })
    expect(sheet.C2).toMatchObject({ t: 'b', v: false })
    expect(sheet.D2).toMatchObject({ t: 's', v: '=备注' })
    expect(sheet.D2.f).toBeUndefined()
    expect(sheet.E2).toMatchObject({ t: 's', v: '[object Object]' })
    expect(sheet.F2).toBeUndefined()
  })

  it('infers columns in first-seen order and keeps an existing XLSX extension', async () => {
    await exportXlsx([{ first: 0, second: false }, { second: 'b', third: 'c' }], 'rows.XLSX')
    const [blob, filename] = mocks.downloadBlob.mock.calls[0]
    expect(filename).toBe('rows.XLSX')
    const sheet = (await readWorkbook(blob)).Sheets['数据']
    expect([sheet.A1.v, sheet.B1.v, sheet.C1.v]).toEqual(['first', 'second', 'third'])
    expect(sheet.C3.v).toBe('c')
  })

  it('keeps named sheets and skips a cancelled download', async () => {
    const spec = { fileName: 'container.xlsx', sheets: [
      { name: '概览', rows: [['数量'], [1]] },
      { name: '明细', rows: [['名称'], ['示例']] }
    ] }
    await expect(writeWorkbookSpec(spec, () => false)).resolves.toBe(false)
    expect(mocks.downloadBlob).not.toHaveBeenCalled()

    await writeWorkbookSpec(spec)
    const [blob] = mocks.downloadBlob.mock.calls[0]
    expect((await readWorkbook(blob)).SheetNames).toEqual(['概览', '明细'])
  })

  it('does not start a download for an empty list', async () => {
    await expect(exportXlsx([], 'rows')).resolves.toBe(false)
    expect(mocks.downloadBlob).not.toHaveBeenCalled()
  })
})
