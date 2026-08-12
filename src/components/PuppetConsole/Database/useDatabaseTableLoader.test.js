import { reactive, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { useDatabaseTableLoader } from './useDatabaseTableLoader.js'

describe('useDatabaseTableLoader', () => {
  it('caches columns and reuses pagination totals after the first page', async () => {
    const getTableColumns = vi.fn().mockResolvedValue({
      data: { columns: [{ name: 'id', type: 'BIGINT', primaryKey: true, comment: '主键' }] }
    })
    const queryTable = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          columns: [{ name: 'id' }],
          rows: [{ id: '9223372036854775807' }],
          pagination: { total: 21 }
        }
      })
      .mockResolvedValueOnce({
        data: { columns: [{ name: 'id' }], rows: [{ id: '2' }], pagination: {} }
      })
    const selectedObject = ref({ schema: 'sales', name: 'orders', kind: 'table' })
    const loader = useDatabaseTableLoader({
      sessionId: 'session-1',
      connection: reactive({ connectionId: 'connection-1', dialect: 'postgresql' }),
      selectedObject,
      sqlEngine: { getTableColumns, queryTable }
    })

    await loader.loadTableRows(selectedObject.value, 1, 10)
    await loader.loadTableRows(selectedObject.value, 2, 10)

    expect(getTableColumns).toHaveBeenCalledTimes(1)
    expect(queryTable).toHaveBeenNthCalledWith(1, expect.objectContaining({ includeTotal: true }))
    expect(queryTable).toHaveBeenNthCalledWith(2, expect.objectContaining({ includeTotal: false }))
    expect(loader.pagination.total).toBe(21)
    expect(loader.tableRows.value).toEqual([{ id: '2' }])
    expect(loader.tableColumns.value[0].comment).toBe('主键')
  })

  it('sends server-side filters and ordering and refreshes totals per query', async () => {
    const getTableColumns = vi.fn().mockResolvedValue({
      data: { columns: [{ name: 'name', type: 'TEXT' }, { name: 'id', type: 'INTEGER' }] }
    })
    const queryTable = vi.fn().mockResolvedValue({
      data: { columns: [{ name: 'name' }, { name: 'id' }], rows: [], pagination: { total: 0 } }
    })
    const selectedObject = ref({ schema: 'sales', name: 'orders', kind: 'table' })
    const loader = useDatabaseTableLoader({
      sessionId: 'session-1',
      connection: reactive({ connectionId: 'connection-1', dialect: 'postgresql' }),
      selectedObject,
      sqlEngine: { getTableColumns, queryTable }
    })

    await loader.loadTableRows(selectedObject.value)
    await loader.applyQuery({
      filters: [
        { field: 'name', operator: 'like', value: '%leo%' },
        { field: 'id', operator: 'in', value: ['1', '2'] }
      ],
      orderBy: [{ field: 'id', direction: 'DESC' }]
    })

    expect(queryTable).toHaveBeenLastCalledWith(
      expect.objectContaining({
        page: 1,
        includeTotal: true,
        filters: [
          { field: 'name', operator: 'like', value: '%leo%' },
          { field: 'id', operator: 'in', value: ['1', '2'] }
        ],
        orderBy: [{ field: 'id', direction: 'DESC' }]
      })
    )
    expect(loader.filters.value).toEqual([
      { field: 'name', operator: 'like', value: '%leo%' },
      { field: 'id', operator: 'in', value: ['1', '2'] }
    ])
    expect(loader.orderBy.value).toEqual([{ field: 'id', direction: 'DESC' }])
  })

  it('cancels stale requests and exposes timeout and truncation state', async () => {
    const getTableColumns = vi.fn().mockResolvedValue({
      data: { columns: [{ name: 'payload', type: 'TEXT' }] }
    })
    const queryTable = vi
      .fn()
      .mockImplementationOnce(({ signal }) => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => {
          const error = new Error('canceled')
          error.name = 'CanceledError'
          reject(error)
        })
      }))
      .mockResolvedValueOnce({
        data: {
          columns: [{ name: 'payload' }],
          rows: [{ payload: 'partial' }],
          rowCount: 1,
          truncated: true,
          truncationReason: 'MAX_RESULT_BYTES',
          resultBytes: 4096,
          pagination: { total: 1 }
        }
      })
    const onError = vi.fn()
    const selectedObject = ref({ catalog: 'main', name: 'events', kind: 'table' })
    const loader = useDatabaseTableLoader({
      sessionId: 'session-1',
      connection: reactive({ connectionId: 'connection-1', dialect: 'sqlite', timeoutSeconds: 30 }),
      selectedObject,
      sqlEngine: { getTableColumns, queryTable },
      onError
    })

    const firstLoad = loader.loadTableRows(selectedObject.value)
    await vi.waitFor(() => expect(queryTable).toHaveBeenCalledTimes(1))
    const firstSignal = queryTable.mock.calls[0][0].signal
    loader.setQueryTimeout(45)
    const secondLoad = loader.loadTableRows(selectedObject.value)
    await Promise.all([firstLoad, secondLoad])

    expect(firstSignal.aborted).toBe(true)
    expect(queryTable).toHaveBeenLastCalledWith(
      expect.objectContaining({
        queryTimeoutSeconds: 45,
        signal: expect.objectContaining({ aborted: false })
      })
    )
    expect(loader.queryStatus).toMatchObject({
      truncated: true,
      truncationReason: 'MAX_RESULT_BYTES',
      resultBytes: 4096,
      rowCount: 1
    })
    expect(onError).not.toHaveBeenCalled()
  })
})
