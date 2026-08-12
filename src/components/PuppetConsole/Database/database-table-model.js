export function getTableColumnNames(columns = []) {
  if (!Array.isArray(columns)) return []
  return columns
    .map((column) => String(column?.name || column?.label || '').trim())
    .filter(Boolean)
}

export function normalizeQueryRows({ queryColumns = [], rows = [], fallbackColumns = [] } = {}) {
  const resultColumns = Array.isArray(queryColumns) ? queryColumns : []
  const fallbackNames = getTableColumnNames(fallbackColumns)
  const columnNames =
    fallbackNames.length > 0 ? fallbackNames : getTableColumnNames(resultColumns)

  if (!Array.isArray(rows)) return { columnNames, rows: [] }

  return {
    columnNames,
    rows: rows.map((row) => {
      const source = row && typeof row === 'object' && !Array.isArray(row) ? row : {}
      return Object.fromEntries(
        columnNames.map((name, index) => {
          const sourceKey = resultColumns[index]?.name || resultColumns[index]?.label || name
          return [name, Object.prototype.hasOwnProperty.call(source, sourceKey) ? source[sourceKey] : null]
        })
      )
    })
  }
}

export function getChangedRowValues(originalRow = {}, editedRow = {}, columns = []) {
  const changed = {}
  for (const name of getTableColumnNames(columns)) {
    const originalValue = originalRow?.[name]
    const editedValue = editedRow?.[name]
    if (
      editedValue !== originalValue &&
      !(editedValue == null && originalValue == null) &&
      !(editedValue === '' && originalValue == null)
    ) {
      changed[name] = editedValue
    }
  }
  return changed
}
