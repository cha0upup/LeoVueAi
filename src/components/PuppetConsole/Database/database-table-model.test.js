import { describe, expect, it } from 'vitest'

import {
  getChangedRowValues,
  getTableColumnNames,
  normalizeQueryRows
} from './database-table-model.js'

describe('database table model', () => {
  it('normalizes backend map rows without creating a header row', () => {
    const result = normalizeQueryRows({
      queryColumns: [{ name: 'id' }, { name: 'amount' }],
      rows: [{ id: '9223372036854775807', amount: '10.20' }]
    })

    expect(result.columnNames).toEqual(['id', 'amount'])
    expect(result.rows).toEqual([{ id: '9223372036854775807', amount: '10.20' }])
  })

  it('calculates changed fields from named row objects', () => {
    expect(
      getChangedRowValues(
        { id: 1, name: 'old', note: null },
        { id: 1, name: 'new', note: '' },
        [{ name: 'id' }, { name: 'name' }, { name: 'note' }]
      )
    ).toEqual({ name: 'new' })
    expect(getTableColumnNames([{ name: 'id' }, { label: 'name' }])).toEqual(['id', 'name'])
  })
})
