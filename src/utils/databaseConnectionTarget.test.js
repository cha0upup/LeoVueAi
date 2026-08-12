import { describe, expect, it } from 'vitest'
import {
  formatDatabaseConnectionTarget,
  getDatabaseConnectionTarget
} from './database.js'

describe('database connection target', () => {
  it('formats standard database targets consistently', () => {
    const connection = {
      dialect: 'postgresql',
      host: 'db.internal',
      port: 5432,
      database: 'app'
    }

    expect(formatDatabaseConnectionTarget(connection)).toBe(
      'postgresql://db.internal:5432/app'
    )
    expect(getDatabaseConnectionTarget({ connection })).toBe(
      'postgresql://db.internal:5432/app'
    )
  })

  it('prefers runtime locators for custom connections', () => {
    expect(
      formatDatabaseConnectionTarget({
        dialect: 'generic',
        connectionMode: 'custom',
        runtimeOptions: { java: { jdbcUrl: 'jdbc:vendor://db/app' } }
      })
    ).toBe('jdbc:vendor://db/app')
  })

  it('uses the database file for SQLite', () => {
    expect(formatDatabaseConnectionTarget({ dialect: 'sqlite', file: '/data/app.db' })).toBe(
      '/data/app.db'
    )
  })
})
