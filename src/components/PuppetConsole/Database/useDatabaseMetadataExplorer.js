import { getCurrentScope, onScopeDispose, ref } from 'vue'

import {
  createNamespaceRef,
  createTableRef,
  getDatabaseObjectCacheKey,
  normalizeDatabaseObjectRef
} from './database-domain.js'
import { isCanceledDatabaseRequest } from './database-query-status.js'

export function useDatabaseMetadataExplorer({
  sessionId,
  connection,
  sqlEngine,
  onError
}) {
  const namespaces = ref([])
  const namespacesLoading = ref(false)
  const tableCache = ref(new Map())
  const tableLoadingKeys = ref(new Set())
  const treeRevision = ref(0)
  let namespacesLoaded = false
  let namespaceController = null
  let namespaceVersion = 0
  const tableControllers = new Map()
  const tableVersions = new Map()

  const namespaceKey = (objectRef) => getDatabaseObjectCacheKey({
    connection,
    objectRef: normalizeDatabaseObjectRef(objectRef)
  })

  const setTablesLoading = (key, loading) => {
    const next = new Set(tableLoadingKeys.value)
    if (loading) next.add(key)
    else next.delete(key)
    tableLoadingKeys.value = next
  }

  const cancelNamespaceRequest = () => {
    namespaceController?.abort()
    namespaceController = null
    namespacesLoading.value = false
  }

  const cancelTableRequests = () => {
    for (const controller of tableControllers.values()) controller.abort()
    tableControllers.clear()
    tableLoadingKeys.value = new Set()
  }

  const reset = () => {
    namespaceVersion += 1
    cancelNamespaceRequest()
    cancelTableRequests()
    tableVersions.clear()
    namespaces.value = []
    tableCache.value = new Map()
    namespacesLoaded = false
    treeRevision.value += 1
  }

  const loadNamespaces = async ({ force = false } = {}) => {
    if (namespacesLoaded && !force) return namespaces.value
    cancelNamespaceRequest()
    const controller = new AbortController()
    namespaceController = controller
    const requestVersion = ++namespaceVersion
    namespacesLoading.value = true
    try {
      const response = await sqlEngine.getDatabases({
        sessionId,
        connection,
        signal: controller.signal
      })
      if (requestVersion !== namespaceVersion) return namespaces.value
      const items = Array.isArray(response?.data?.databases) ? response.data.databases : []
      namespaces.value = items.map((item) => ({
        name: item.name || '',
        objectRef:
          item.ref ||
          createNamespaceRef(item.name, sqlEngine.getNamespaceLevels(connection.dialect))
      }))
      namespacesLoaded = true
      return namespaces.value
    } catch (error) {
      if (!isCanceledDatabaseRequest(error) && requestVersion === namespaceVersion) {
        onError?.(error, '加载数据库结构失败')
      }
      return namespaces.value
    } finally {
      if (requestVersion === namespaceVersion) {
        namespacesLoading.value = false
        if (namespaceController === controller) namespaceController = null
      }
    }
  }

  const getTables = (objectRef) => tableCache.value.get(namespaceKey(objectRef)) || []

  const isTablesLoading = (objectRef) => tableLoadingKeys.value.has(namespaceKey(objectRef))

  const loadTables = async (objectRef, { force = false } = {}) => {
    const namespaceRef = normalizeDatabaseObjectRef(objectRef)
    const key = namespaceKey(namespaceRef)
    if (!namespaceRef.kind || (!namespaceRef.catalog && !namespaceRef.schema)) return []
    if (tableCache.value.has(key) && !force) return getTables(namespaceRef)

    tableControllers.get(key)?.abort()
    const controller = new AbortController()
    tableControllers.set(key, controller)
    const requestVersion = (tableVersions.get(key) || 0) + 1
    tableVersions.set(key, requestVersion)
    setTablesLoading(key, true)
    try {
      const response = await sqlEngine.getTables({
        sessionId,
        connection,
        objectRef: namespaceRef,
        signal: controller.signal
      })
      if (tableVersions.get(key) !== requestVersion) return getTables(namespaceRef)
      const items = Array.isArray(response?.data?.tables) ? response.data.tables : []
      const tables = items.map((item) => ({
        name: item.name || '',
        schema: item.schema || '',
        comment: item.comment || '',
        objectRef: createTableRef({
          namespaceRef,
          table: item.name,
          schema: item.schema,
          ref: item.ref
        })
      }))
      const nextCache = new Map(tableCache.value)
      nextCache.set(key, tables)
      tableCache.value = nextCache
      return tables
    } catch (error) {
      if (!isCanceledDatabaseRequest(error) && tableVersions.get(key) === requestVersion) {
        onError?.(error, `加载 ${namespaceRef.catalog || namespaceRef.schema} 的表列表失败`)
      }
      return getTables(namespaceRef)
    } finally {
      if (tableVersions.get(key) === requestVersion) {
        setTablesLoading(key, false)
        if (tableControllers.get(key) === controller) tableControllers.delete(key)
      }
    }
  }

  const refreshNamespaces = async () => {
    reset()
    return loadNamespaces({ force: true })
  }

  const refreshTables = async (objectRef) => {
    const key = namespaceKey(objectRef)
    const nextCache = new Map(tableCache.value)
    nextCache.delete(key)
    tableCache.value = nextCache
    treeRevision.value += 1
    return loadTables(objectRef, { force: true })
  }

  if (getCurrentScope()) {
    onScopeDispose(() => {
      cancelNamespaceRequest()
      cancelTableRequests()
    })
  }

  return {
    namespaces,
    namespacesLoading,
    treeRevision,
    getTables,
    isTablesLoading,
    loadNamespaces,
    loadTables,
    refreshNamespaces,
    refreshTables,
    reset
  }
}
