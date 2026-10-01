import { describe, expect, it } from 'vitest'

import {
  hydrateDatabaseFilterDrafts,
  normalizeDatabaseOrderBy,
  operatorNeedsValue,
  serializeDatabaseFilters
} from './database-table-query.js'

describe('database table query model', () => {
  it('serializes multiple filters without UI-only keys', () => {
    const filters = serializeDatabaseFilters([
      { key: 'one', field: 'status', operator: 'in', value: 'new, paid, new' },
      { key: 'two', field: 'deleted_at', operator: 'is_null', value: 'ignored' },
      { key: 'three', field: '', operator: 'eq', value: 'ignored' }
    ])

    expect(filters).toEqual([
      { field: 'status', operator: 'in', value: ['new', 'paid', 'new'] },
      { field: 'deleted_at', operator: 'is_null' }
    ])

    expect(serializeDatabaseFilters([
      { field: 'nullable_id', operator: 'eq', value: null }
    ])).toEqual([{ field: 'nullable_id', operator: 'eq', value: null }])
  })

  it('hydrates list values and always provides one editable draft', () => {
    expect(hydrateDatabaseFilterDrafts([])).toHaveLength(1)
    expect(
      hydrateDatabaseFilterDrafts([{ field: 'id', operator: 'not_in', value: [1, 2] }])[0]
    ).toMatchObject({ field: 'id', operator: 'not_in', value: '1, 2' })
    expect(operatorNeedsValue('is_null')).toBe(false)
    expect(operatorNeedsValue('eq')).toBe(true)
  })

  it('normalizes ordering directions and removes empty fields', () => {
    expect(normalizeDatabaseOrderBy([
      { field: 'created_at', direction: 'desc' },
      { field: '', direction: 'ASC' }
    ])).toEqual([{ field: 'created_at', direction: 'DESC' }])
  })
})
