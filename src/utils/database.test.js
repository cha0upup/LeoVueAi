import { describe, expect, it, vi } from 'vitest'
import {
  buildWherePayloadFromRow,
  deleteRowsData,
  exportTableData,
  formatCellValue,
  formatDatabaseConnectionTarget,
  getDatabaseConnectionTarget,
  getInputComponentByType,
  performDatabaseExport
} from './database.js'

const tableRef = { catalog: 'app', schema: 'sales', name: 'orders', kind: 'table' }
const namespaceRef = { catalog: 'app', kind: 'catalog' }
const tableRefs = [tableRef, { catalog: 'app', schema: 'crm', name: 'customers', kind: 'table' }]
const context = { sessionId: 'session-1', connection: { dialect: 'sqlserver' } }

describe('database value and request contracts', () => {
  it('keeps exact numbers as text in display, controls and primary-key predicates', () => {
    const id = '9223372036854775807'
    const decimal = '1234567890.123456789'
    expect(formatCellValue(id, { type: 'BIGINT' })).toBe(id)
    expect(formatCellValue(decimal, { type: 'DECIMAL(30,9)' })).toBe(decimal)
    expect(getInputComponentByType('BIGINT')).toBe('el-input')
    expect(getInputComponentByType('NUMERIC(30, 10)')).toBe('el-input')
    expect(buildWherePayloadFromRow(['id', 'name'], { id, name: 'alpha' }, [
      { name: 'id', primaryKey: true }, { name: 'name' }
    ])).toEqual({ type: 'pk', values: { id } })
  })

  it('distinguishes NULL from empty text in display and full-row filters', () => {
    expect(formatCellValue(null, { type: 'VARCHAR' })).toBe('(NULL)')
    expect(formatCellValue('', { type: 'VARCHAR' })).toBe('')
    expect(buildWherePayloadFromRow(['name', 'note'], { name: '', note: null })).toEqual({
      filters: [
        { field: 'name', operator: 'eq', value: '' },
        { field: 'note', operator: 'is_null' }
      ]
    })
  })

  it.each([
    [{ dialect: 'postgresql', host: 'db.internal', port: 5432, database: 'app' }, 'postgresql://db.internal:5432/app'],
    [{ dialect: 'generic', connectionMode: 'custom', runtimeOptions: { java: { jdbcUrl: 'jdbc:vendor://db/app' } } }, 'jdbc:vendor://db/app'],
    [{ dialect: 'sqlite', file: '/data/app.db' }, '/data/app.db']
  ])('formats direct and wrapped connection targets consistently: %j', (connection, expected) => {
    expect(formatDatabaseConnectionTarget(connection)).toBe(expected)
    expect(getDatabaseConnectionTarget({ connection })).toBe(expected)
  })

  it('deletes named rows with typed object references and counts successful operations', async () => {
    const connection = { dialect: 'postgresql' }
    const objectRef = { schema: 'sales', name: 'orders', kind: 'table' }
    const deleteRows = vi.fn().mockResolvedValue({ data: { affectedRows: 1 } })
    const count = await deleteRowsData({
      sessionId: context.sessionId, connection, objectRef, headers: ['id'],
      rows: [{ id: 1 }, { id: 2 }], columnsMeta: [{ name: 'id', primaryKey: true }],
      sqlEngine: { deleteRows }
    })
    expect(count).toBe(2)
    expect(deleteRows).toHaveBeenCalledTimes(2)
    for (const id of [1, 2]) {
      expect(deleteRows).toHaveBeenNthCalledWith(id, {
        sessionId: context.sessionId, connection, objectRef, where: { type: 'pk', values: { id } }
      })
    }
  })

  it.each([
    { label: 'table', execute: exportTableData, method: 'exportTable',
      selection: { objectRef: tableRef, tableRows: [{ id: 1 }] },
      payload: { objectRef: tableRef, format: 'csv' } },
    { label: 'database', execute: performDatabaseExport, method: 'exportDatabase',
      selection: { objectRef: namespaceRef, tableRefs },
      payload: { objectRef: namespaceRef, tableRefs, includeStructure: true, includeData: true, format: 'zip' } }
  ])('keeps typed references and options in $label export requests', async ({ execute, method, selection, payload }) => {
    const task = { taskId: 'export-task' }
    const request = vi.fn().mockResolvedValue({ data: task })
    await expect(execute({ ...context, ...selection, sqlEngine: { [method]: request } })).resolves.toBe(task)
    expect(request).toHaveBeenCalledExactlyOnceWith({ ...context, ...payload })
  })

  it.each([
    { objectRef: null, tableRows: [{ id: 1 }] },
    { objectRef: tableRef, tableRows: [] }
  ])('does not export without a selected table and rows', async selection => {
    const exportTable = vi.fn()
    const onError = vi.fn()
    await exportTableData({ ...selection, sqlEngine: { exportTable }, onError })
    expect(exportTable).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledOnce()
  })
})
