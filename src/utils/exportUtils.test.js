import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  downloadBlob: vi.fn(),
  handleError: vi.fn(),
  showSuccess: vi.fn()
}))

vi.mock('./downloadBlob.js', () => ({ downloadBlob: mocks.downloadBlob }))
vi.mock('./errorHandler.js', () => ({ handleError: mocks.handleError }))
vi.mock('./messageUtils.js', () => ({ showSuccess: mocks.showSuccess }))

import { executeBlobDownload, exportCsv, exportTsv } from './exportUtils.js'
import { getDockerExportConfig } from '../components/AgentConsole/Docker/dockerManagerModel.js'

beforeEach(() => vi.resetAllMocks())

describe('executeBlobDownload', () => {
  it('downloads the original Blob before reporting success and completing the request', async () => {
    const response = { data: new Blob(['archive']) }
    const loadingRef = ref(false)
    let finishRequest
    const pending = new Promise((resolve) => { finishRequest = resolve })
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

describe('exportCsv', () => {
  it('exports Chinese headers and computed columns with UTF-8 BOM and CSV escaping', async () => {
    exportCsv([{ title: '中文,含"引号"\r\n下一行', count: 0, active: false }], 'results', [
      { label: '标题', key: 'title' },
      { label: '数量', key: 'count' },
      { label: '启用', key: (row) => row.active },
      { label: '缺失', key: 'missing' }
    ])

    const [blob, filename] = mocks.downloadBlob.mock.calls[0]
    expect(filename).toBe('results.csv')
    expect(blob.type).toBe('text/csv;charset=utf-8')
    expect([...new Uint8Array(await blob.arrayBuffer()).slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    await expect(blob.text()).resolves.toBe('标题,数量,启用,缺失\r\n"中文,含""引号""\r\n下一行",0,false,')
  })

  it('infers columns in first-seen order and keeps existing CSV extensions', async () => {
    exportCsv([{ first: 0, second: false }, { second: 'b', third: 'c' }], 'rows.CSV')
    const [blob, filename] = mocks.downloadBlob.mock.calls[0]
    expect(filename).toBe('rows.CSV')
    await expect(blob.text()).resolves.toBe('first,second,third\r\n0,false,\r\n,b,c')
  })

  it.each(['=1+1', '+cmd', '-cmd', '@SUM(A1)', '  =1+1', '\tformula', '\rformula', '\nformula'])(
    'exports untrusted text %j as data rather than a spreadsheet formula', async (value) => {
      exportCsv([{ value }], 'rows')
      const [blob] = mocks.downloadBlob.mock.calls[0]
      const cell = `'${value}`
      await expect(blob.text()).resolves.toBe(`value\r\n${/[\r\n]/.test(cell) ? `"${cell}"` : cell}`)
    }
  )

  it('keeps negative numeric values numeric and handles nulls', async () => {
    exportCsv([{ number: -2, value: null }], 'rows')
    await expect(mocks.downloadBlob.mock.calls[0][0].text()).resolves.toBe('number,value\r\n-2,')
  })

  it.each([[], null, undefined])('skips empty data %j', (data) => {
    exportCsv(data, 'rows')
    expect(mocks.downloadBlob).not.toHaveBeenCalled()
  })
})

describe('exportTsv', () => {
  it('shares field rendering for explicit columns and computed values', async () => {
    exportTsv([{ name: 'a\tb\nc\r', count: 0, active: false }], 'rows', [
      { label: 'Name', key: 'name' },
      { label: 'Count', key: 'count' },
      { label: 'Active', key: (row) => row.active },
      { label: 'Missing', key: 'missing' }
    ])

    const [blob, filename] = mocks.downloadBlob.mock.calls[0]
    expect(filename).toBe('rows.tsv')
    expect(blob.type).toBe('text/tab-separated-values;charset=utf-8')
    await expect(blob.text()).resolves.toBe('Name\tCount\tActive\tMissing\na b c \t0\tfalse\t')
  })

  it('collects dynamic columns in first-seen order and aligns missing fields', async () => {
    exportTsv([{ first: 0, second: false }, { second: 'b', third: 'c' }], 'rows.tsv')
    const [blob, filename] = mocks.downloadBlob.mock.calls[0]

    expect(filename).toBe('rows.tsv')
    await expect(blob.text()).resolves.toBe('first\tsecond\tthird\n0\tfalse\t\n\tb\tc')
  })

  it('does not start a download for an empty list', () => {
    exportTsv([], 'rows')
    expect(mocks.downloadBlob).not.toHaveBeenCalled()
  })

  it.each([
    ['containers', { id: 'c1', name: 'web', image: 'nginx', status: 'Up', ports: '80', created: 'today' },
      'id\tname\timage\tstatus\tports\tcreated\nc1\tweb\tnginx\tUp\t80\ttoday'],
    ['images', { repository: 'nginx', tag: 'stable', id: 'i1', size: '10MB', created: 'today' },
      'repository\ttag\tid\tsize\tcreated\nnginx\tstable\ti1\t10MB\ttoday'],
    ['networks', { id: 'n1', name: 'bridge', driver: 'bridge', scope: 'local' },
      'id\tname\tdriver\tscope\nn1\tbridge\tbridge\tlocal']
  ])('exports Docker %s using the current column contract', async (tab, row, expected) => {
    const config = getDockerExportConfig(tab)
    exportTsv([row], config.filename, config.columns)
    const [blob, filename] = mocks.downloadBlob.mock.calls[0]

    expect(filename).toBe('docker-' + tab + '.tsv')
    await expect(blob.text()).resolves.toBe(expected)
  })
})
