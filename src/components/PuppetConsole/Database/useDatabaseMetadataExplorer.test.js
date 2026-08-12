import { reactive } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { useDatabaseMetadataExplorer } from './useDatabaseMetadataExplorer.js'

describe('useDatabaseMetadataExplorer', () => {
  it('normalizes and caches namespace and table metadata', async () => {
    const getDatabases = vi.fn().mockResolvedValue({
      data: { databases: [{ name: 'sales', ref: { kind: 'schema', schema: 'sales' } }] }
    })
    const getTables = vi.fn().mockResolvedValue({
      data: {
        tables: [{
          name: 'orders',
          schema: 'sales',
          comment: '订单',
          ref: { kind: 'table', schema: 'sales', name: 'orders' }
        }]
      }
    })
    const explorer = useDatabaseMetadataExplorer({
      sessionId: 'session-1',
      connection: reactive({ connectionId: 'connection-1', dialect: 'postgresql' }),
      sqlEngine: { getDatabases, getTables, getNamespaceLevels: () => ['schema'] }
    })

    const namespaces = await explorer.loadNamespaces()
    const tables = await explorer.loadTables(namespaces[0].objectRef)
    await explorer.loadNamespaces()
    await explorer.loadTables(namespaces[0].objectRef)

    expect(getDatabases).toHaveBeenCalledTimes(1)
    expect(getTables).toHaveBeenCalledTimes(1)
    expect(tables).toEqual([{
      name: 'orders',
      schema: 'sales',
      comment: '订单',
      objectRef: { catalog: '', schema: 'sales', name: 'orders', kind: 'table' }
    }])
    expect(explorer.getTables(namespaces[0].objectRef)).toEqual(tables)
  })

  it('refreshes one namespace without keeping its previous table cache', async () => {
    const getTables = vi
      .fn()
      .mockResolvedValueOnce({ data: { tables: [{ name: 'orders' }] } })
      .mockResolvedValueOnce({ data: { tables: [{ name: 'invoices' }] } })
    const explorer = useDatabaseMetadataExplorer({
      sessionId: 'session-1',
      connection: reactive({ connectionId: 'connection-1', dialect: 'mysql' }),
      sqlEngine: { getDatabases: vi.fn(), getTables, getNamespaceLevels: () => ['catalog'] }
    })
    const namespaceRef = { kind: 'catalog', catalog: 'sales' }

    await explorer.loadTables(namespaceRef)
    const revision = explorer.treeRevision.value
    const refreshed = await explorer.refreshTables(namespaceRef)

    expect(getTables).toHaveBeenCalledTimes(2)
    expect(refreshed[0].name).toBe('invoices')
    expect(explorer.treeRevision.value).toBe(revision + 1)
  })
})
