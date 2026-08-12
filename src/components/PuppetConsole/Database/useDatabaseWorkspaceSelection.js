import { computed, ref } from 'vue'

import {
  DATABASE_OBJECT_KINDS,
  normalizeDatabaseObjectRef
} from './database-domain.js'

const EMPTY_SELECTION_KEY = '|||'

function selectionKey(objectRef) {
  const ref = normalizeDatabaseObjectRef(objectRef)
  return [ref.kind, ref.catalog, ref.schema, ref.name].join('|')
}

export function useDatabaseWorkspaceSelection() {
  const selectedObject = ref(null)

  const currentTableRef = computed(() =>
    selectedObject.value?.kind === DATABASE_OBJECT_KINDS.TABLE
      ? selectedObject.value
      : null
  )

  const currentNamespaceRef = computed(() => {
    const selected = selectedObject.value
    if (!selected) return null
    if (selected.kind === DATABASE_OBJECT_KINDS.CATALOG) return selected
    if (selected.kind === DATABASE_OBJECT_KINDS.SCHEMA) return selected
    if (selected.kind !== DATABASE_OBJECT_KINDS.TABLE) return null
    if (selected.catalog) {
      return normalizeDatabaseObjectRef({
        catalog: selected.catalog,
        kind: DATABASE_OBJECT_KINDS.CATALOG
      })
    }
    if (selected.schema) {
      return normalizeDatabaseObjectRef({
        schema: selected.schema,
        kind: DATABASE_OBJECT_KINDS.SCHEMA
      })
    }
    return null
  })

  const currentDatabase = computed(() => {
    const selected = selectedObject.value
    if (!selected) return ''
    return selected.catalog || selected.schema || ''
  })

  const currentTable = computed(() => currentTableRef.value?.name || '')

  const selectObject = (objectRef) => {
    const next = normalizeDatabaseObjectRef(objectRef)
    const nextKey = selectionKey(next)
    if (nextKey === EMPTY_SELECTION_KEY) return false
    const changed = selectionKey(selectedObject.value) !== nextKey
    selectedObject.value = next
    return changed
  }

  const clearSelection = () => {
    const changed = selectedObject.value !== null
    selectedObject.value = null
    return changed
  }

  return {
    selectedObject,
    currentDatabase,
    currentTable,
    currentNamespaceRef,
    currentTableRef,
    selectObject,
    clearSelection
  }
}
