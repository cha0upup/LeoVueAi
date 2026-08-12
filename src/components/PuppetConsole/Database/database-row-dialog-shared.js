import { computed } from 'vue'
import {
  getInputComponentByType,
  getInputPropsByType,
  getColumnMetaInfo
} from '@/utils/database.js'

export function resetDatabaseRowFormData(formData, data = {}) {
  Object.keys(formData).forEach((key) => delete formData[key])
  Object.assign(formData, data)
}

export function useDatabaseRowDialog({ props, formData, mode }) {
  const getColumn = (columnIndex) => props.tableColumns?.[columnIndex] || null

  const getInputComponent = (columnIndex) => {
    const column = getColumn(columnIndex)
    return getInputComponentByType(column?.type) || 'el-input'
  }

  const getInputProps = (columnIndex) => {
    const column = getColumn(columnIndex)
    return getInputPropsByType(column?.type, column, mode) || { size: 'default' }
  }

  const getColumnMeta = (columnIndex) => {
    const column = getColumn(columnIndex)
    return getColumnMetaInfo(column)
  }

  const tableRows = computed(() => {
    if (!Array.isArray(props.tableColumns) || props.tableColumns.length === 0) {
      return []
    }

    return props.tableColumns.map((column, index) => {
      const header = column?.name || ''
      const meta = getColumnMeta(index)
      return {
        fieldName: header,
        type: meta.type || '',
        nullable: meta.nullable,
        inputComponent: getInputComponent(index),
        inputProps: getInputProps(index),
        value: formData[header]
      }
    })
  })

  return {
    getColumn,
    getInputComponent,
    getInputProps,
    getColumnMeta,
    tableRows
  }
}
