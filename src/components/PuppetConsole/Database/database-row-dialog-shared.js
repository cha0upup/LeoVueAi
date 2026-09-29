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

export function useDatabaseRowDialog({ props, formData }) {
  const getColumnMeta = (columnIndex) => getColumnMetaInfo(props.tableColumns[columnIndex])

  const tableRows = computed(() => {
    return props.tableColumns.map((column) => {
      const header = column?.name || ''
      const meta = getColumnMetaInfo(column)
      return {
        fieldName: header,
        type: meta.type,
        nullable: meta.nullable,
        inputComponent: getInputComponentByType(column?.type),
        inputProps: getInputPropsByType(column?.type, column),
        value: formData[header]
      }
    })
  })

  return {
    getColumnMeta,
    tableRows
  }
}
