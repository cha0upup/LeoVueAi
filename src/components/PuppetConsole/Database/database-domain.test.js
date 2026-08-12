import { describe, expect, it } from 'vitest'
import {
  createNamespaceRef,
  createTableRef,
  getDatabaseObjectCacheKey,
  getDatabaseObjectLabel,
  hasDatabaseCapability
} from './database-domain.js'

describe('database domain model', () => {
  it('keeps catalog and schema identities separate', () => {
    const catalog = createNamespaceRef('sales', ['catalog'])
    const schema = createNamespaceRef('reporting', ['schema'])

    expect(catalog).toMatchObject({ catalog: 'sales', schema: '', kind: 'catalog' })
    expect(schema).toMatchObject({ catalog: '', schema: 'reporting', kind: 'schema' })
  })

  it('preserves a SQL Server table object reference returned by the backend', () => {
    const ref = createTableRef({
      namespaceRef: createNamespaceRef('warehouse', ['catalog', 'schema']),
      table: 'orders',
      ref: { catalog: 'warehouse', schema: 'audit', name: 'orders', kind: 'table' }
    })

    expect(ref).toEqual({ catalog: 'warehouse', schema: 'audit', name: 'orders', kind: 'table' })
    expect(getDatabaseObjectLabel(ref)).toBe('orders')
  })

  it('projects backend capabilities without dialect-specific conditionals', () => {
    const config = { capabilities: { rawSql: true, structuredQuery: false } }
    expect(hasDatabaseCapability(config, 'rawSql')).toBe(true)
    expect(hasDatabaseCapability(config, 'structuredQuery')).toBe(false)
  })

  it('creates stable cache keys from connection and object coordinates', () => {
    const input = {
      connection: { connectionId: 'connection-1', dialect: 'sqlserver' },
      database: 'app',
      table: 'orders',
      objectRef: { catalog: 'app', schema: 'sales', name: 'orders', kind: 'table' }
    }

    expect(getDatabaseObjectCacheKey(input)).toBe(getDatabaseObjectCacheKey({ ...input }))
    expect(
      getDatabaseObjectCacheKey({
        ...input,
        objectRef: { ...input.objectRef, schema: 'archive' }
      })
    ).not.toBe(getDatabaseObjectCacheKey(input))
    expect(
      getDatabaseObjectCacheKey({
        ...input,
        objectRef: { ...input.objectRef, kind: 'view' }
      })
    ).not.toBe(getDatabaseObjectCacheKey(input))
  })
})
