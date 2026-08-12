import { describe, expect, it, vi } from 'vitest'

import { exportTableData, performDatabaseExport } from './database.js'

describe('database export payloads', () => {
  it('keeps the selected table object reference for single-table export', async () => {
    const exportTable = vi.fn().mockResolvedValue({ data: { taskId: 'table-task' } })
    const objectRef = { catalog: 'app', schema: 'sales', name: 'orders', kind: 'table' }

    await exportTableData({
      sessionId: 'session-1',
      connection: { dialect: 'sqlserver' },
      databaseName: 'app',
      tableName: 'orders',
      objectRef,
      tableData: [['id'], [1]],
      sqlEngine: { exportTable }
    })

    expect(exportTable).toHaveBeenCalledWith(
      expect.objectContaining({ objectRef })
    )
    expect(exportTable.mock.calls[0][0]).not.toHaveProperty('database')
    expect(exportTable.mock.calls[0][0]).not.toHaveProperty('table')
  })

  it('keeps namespace and table refs for database export', async () => {
    const exportDatabase = vi.fn().mockResolvedValue({ data: { taskId: 'database-task' } })
    const objectRef = { catalog: 'app', kind: 'catalog' }
    const tableRefs = [
      { catalog: 'app', schema: 'sales', name: 'orders', kind: 'table' },
      { catalog: 'app', schema: 'crm', name: 'customers', kind: 'table' }
    ]

    await performDatabaseExport({
      sessionId: 'session-1',
      connection: { dialect: 'sqlserver' },
      objectRef,
      tableRefs,
      sqlEngine: { exportDatabase }
    })

    expect(exportDatabase).toHaveBeenCalledWith(
      expect.objectContaining({ objectRef, tableRefs })
    )
    expect(exportDatabase.mock.calls[0][0]).not.toHaveProperty('database')
    expect(exportDatabase.mock.calls[0][0]).not.toHaveProperty('tables')
  })
})
