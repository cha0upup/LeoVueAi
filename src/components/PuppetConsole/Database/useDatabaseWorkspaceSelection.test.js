import { describe, expect, it } from 'vitest'

import { useDatabaseWorkspaceSelection } from './useDatabaseWorkspaceSelection.js'

describe('useDatabaseWorkspaceSelection', () => {
  it('derives schema selection state from one selected object', () => {
    const selection = useDatabaseWorkspaceSelection()

    expect(selection.selectObject({ kind: 'schema', schema: 'sales' })).toBe(true)
    expect(selection.currentDatabase.value).toBe('sales')
    expect(selection.currentTable.value).toBe('')
    expect(selection.currentNamespaceRef.value).toEqual({
      catalog: '',
      schema: 'sales',
      name: '',
      kind: 'schema'
    })
    expect(selection.currentTableRef.value).toBeNull()
  })

  it('derives SQL Server catalog and table state without parallel refs', () => {
    const selection = useDatabaseWorkspaceSelection()
    const table = { kind: 'table', catalog: 'ERP', schema: 'audit', name: 'events' }

    expect(selection.selectObject(table)).toBe(true)
    expect(selection.selectObject({ ...table })).toBe(false)
    expect(selection.currentDatabase.value).toBe('ERP')
    expect(selection.currentTable.value).toBe('events')
    expect(selection.currentTableRef.value).toEqual({
      catalog: 'ERP',
      schema: 'audit',
      name: 'events',
      kind: 'table'
    })
    expect(selection.currentNamespaceRef.value).toEqual({
      catalog: 'ERP',
      schema: '',
      name: '',
      kind: 'catalog'
    })
  })

  it('clears all derived state together', () => {
    const selection = useDatabaseWorkspaceSelection()
    selection.selectObject({ kind: 'table', schema: 'APP', name: 'ORDERS' })

    expect(selection.clearSelection()).toBe(true)
    expect(selection.selectedObject.value).toBeNull()
    expect(selection.currentDatabase.value).toBe('')
    expect(selection.currentTable.value).toBe('')
    expect(selection.currentNamespaceRef.value).toBeNull()
    expect(selection.currentTableRef.value).toBeNull()
  })
})
