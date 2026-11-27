import { reactive } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { deferred } from '@/test-support/deferred.js'

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
      sqlEngine: { getDatabases, getTables }
    })

    const [namespaces, concurrentNamespaces] = await Promise.all([
      explorer.loadNamespaces(), explorer.loadNamespaces()
    ])
    expect(getDatabases).toHaveBeenCalledTimes(1)
    expect(concurrentNamespaces).toEqual(namespaces)
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

  it('shares a pending table listing between the tree and export', async () => {
    const namespaceRef = { kind: 'catalog', catalog: 'sales' }
    const getTables = vi.fn().mockResolvedValue({ data: { tables: [{
      name: 'orders', ref: { catalog: 'sales', name: 'orders', kind: 'table' }
    }] } })
    const explorer = useDatabaseMetadataExplorer({
      sessionId: 'session-1', connection: { dialect: 'mysql' }, sqlEngine: { getTables }
    })

    const [treeTables, exportTables] = await Promise.all([
      explorer.loadTables(namespaceRef), explorer.loadTables({ ...namespaceRef })
    ])

    expect(getTables).toHaveBeenCalledTimes(1)
    expect(treeTables.map(({ name }) => name)).toEqual(['orders'])
    expect(exportTables).toEqual(treeTables)
  })

  it('keeps an aborted lookup from filling the cache after reset and reload of the same namespace', async () => {
    const stale = deferred()
    const fresh = deferred()
    const getTables = vi.fn().mockReturnValueOnce(stale.promise).mockReturnValueOnce(fresh.promise)
    const namespaceRef = { kind: 'catalog', catalog: 'sales' }
    const explorer = useDatabaseMetadataExplorer({
      sessionId: 'session-1', connection: { dialect: 'mysql' }, sqlEngine: { getTables }
    })

    const abandoned = explorer.loadTables(namespaceRef)
    await Promise.resolve()
    explorer.reset()
    expect(getTables.mock.calls[0][0].signal.aborted).toBe(true)
    const reloaded = explorer.loadTables(namespaceRef)

    stale.resolve({ data: { tables: [{ name: 'obsolete' }] } })
    expect(await abandoned).toEqual([])
    expect(explorer.getTables(namespaceRef)).toEqual([])
    expect(explorer.isTablesLoading(namespaceRef)).toBe(true)

    fresh.resolve({ data: { tables: [{ name: 'orders' }] } })
    expect((await reloaded).map(({ name }) => name)).toEqual(['orders'])
    expect(explorer.isTablesLoading(namespaceRef)).toBe(false)
  })

  it('refreshes one namespace without keeping its previous table cache', async () => {
    const getTables = vi
      .fn()
      .mockResolvedValueOnce({ data: { tables: [{
        name: 'orders', ref: { catalog: 'sales', name: 'orders', kind: 'table' }
      }] } })
      .mockResolvedValueOnce({ data: { tables: [{
        name: 'invoices', ref: { catalog: 'sales', name: 'invoices', kind: 'table' }
      }] } })
    const explorer = useDatabaseMetadataExplorer({
      sessionId: 'session-1',
      connection: reactive({ connectionId: 'connection-1', dialect: 'mysql' }),
      sqlEngine: { getDatabases: vi.fn(), getTables }
    })
    const namespaceRef = { kind: 'catalog', catalog: 'sales' }

    await explorer.loadTables(namespaceRef)
    const revision = explorer.treeRevision.value
    const refreshed = await explorer.refreshTables(namespaceRef)

    expect(getTables).toHaveBeenCalledTimes(2)
    expect(refreshed[0].name).toBe('invoices')
    expect(explorer.treeRevision.value).toBe(revision + 1)
  })

  it('preserves same-named SQL Server tables in different schemas through export', async () => {
    const { performDatabaseExport } = await import('@/utils/database.js')
    const namespaceRef = { kind: 'catalog', catalog: 'warehouse' }
    const tableRefs = ['sales', 'audit'].map((schema) => ({
      ...namespaceRef, schema, name: 'orders', kind: 'table'
    }))
    const connection = reactive({ connectionId: 'connection-1', dialect: 'sqlserver' })
    const sqlEngine = {
      getTables: vi.fn().mockResolvedValue({
        data: { tables: tableRefs.map((ref) => ({ name: ref.name, schema: ref.schema, ref })) }
      }),
      exportDatabase: vi.fn().mockResolvedValue({ data: { taskId: 'export-1' } })
    }
    const explorer = useDatabaseMetadataExplorer({ sessionId: 'session-1', connection, sqlEngine })

    const tables = await explorer.loadTables(namespaceRef)
    await performDatabaseExport({
      sessionId: 'session-1',
      connection,
      objectRef: namespaceRef,
      tableRefs: tables.map((table) => table.objectRef),
      sqlEngine
    })

    expect(sqlEngine.exportDatabase).toHaveBeenCalledWith(expect.objectContaining({
      objectRef: namespaceRef,
      tableRefs
    }))
  })
})
