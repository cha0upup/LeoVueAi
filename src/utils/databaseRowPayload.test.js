import { describe, expect, it, vi } from 'vitest'

import { buildWherePayloadFromRow, deleteRowsData } from './database.js'

describe('database named-row payloads', () => {
  it('builds primary-key predicates from named rows', () => {
    expect(
      buildWherePayloadFromRow(['id', 'name'], { id: '9223372036854775807', name: 'alpha' }, [
        { name: 'id', primaryKey: true },
        { name: 'name' }
      ])
    ).toEqual({ type: 'pk', values: { id: '9223372036854775807' } })
  })

  it('keeps empty strings distinct from NULL in full-row filters', () => {
    expect(buildWherePayloadFromRow(['name', 'note'], { name: '', note: null })).toEqual({
      filters: [
        { field: 'name', operator: 'eq', value: '' },
        { field: 'note', operator: 'is_null' }
      ]
    })
  })

  it('deletes batches of named rows', async () => {
    const deleteRows = vi.fn().mockResolvedValue({ data: { affectedRows: 1 } })
    const count = await deleteRowsData({
      sessionId: 'session-1',
      connection: { dialect: 'postgresql' },
      objectRef: { schema: 'sales', name: 'orders', kind: 'table' },
      headers: ['id'],
      rows: [{ id: 1 }, { id: 2 }],
      columnsMeta: [{ name: 'id', primaryKey: true }],
      sqlEngine: { deleteRows }
    })

    expect(count).toBe(2)
    expect(deleteRows).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ where: { type: 'pk', values: { id: 1 } } })
    )
    expect(deleteRows.mock.calls[0][0]).not.toHaveProperty('database')
    expect(deleteRows.mock.calls[0][0]).not.toHaveProperty('table')
  })
})
