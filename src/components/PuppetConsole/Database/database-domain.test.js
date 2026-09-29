import { describe, expect, it } from 'vitest'
import {
  normalizeDatabaseObjectRef,
  getDatabaseObjectCacheKey,
  getDatabaseObjectLabel
} from './database-domain.js'

describe('database domain model', () => {
  it('keeps catalog and schema identities separate', () => {
    const catalog = normalizeDatabaseObjectRef({ catalog: 'sales', kind: 'catalog' })
    const schema = normalizeDatabaseObjectRef({ schema: 'reporting', kind: 'schema' })

    expect(catalog).toMatchObject({ catalog: 'sales', schema: '', kind: 'catalog' })
    expect(schema).toMatchObject({ catalog: '', schema: 'reporting', kind: 'schema' })
  })

  it('preserves a SQL Server table object reference returned by the backend', () => {
    const ref = normalizeDatabaseObjectRef({
      catalog: 'warehouse', schema: 'audit', name: 'orders', kind: 'table'
    })

    expect(ref).toEqual({ catalog: 'warehouse', schema: 'audit', name: 'orders', kind: 'table' })
    expect(getDatabaseObjectLabel(ref)).toBe('orders')
  })

  it('creates stable cache keys from connection and object coordinates', () => {
    const input = {
      connection: { connectionId: 'connection-1', dialect: 'sqlserver' },
      objectRef: { catalog: 'app', schema: 'sales', name: 'orders', kind: 'table' }
    }

    expect(getDatabaseObjectCacheKey(input)).toBe(getDatabaseObjectCacheKey({ ...input }))
    expect(
      getDatabaseObjectCacheKey({
        ...input,
        connection: { ...input.connection, connectionId: 'connection-2' }
      })
    ).not.toBe(getDatabaseObjectCacheKey(input))
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
