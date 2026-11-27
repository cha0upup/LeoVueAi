import { computed, getCurrentScope, onScopeDispose, reactive, ref, shallowReactive } from 'vue'

import {
  getDatabaseObjectCacheKey,
  normalizeDatabaseObjectRef
} from './database-domain.js'
import { isCanceledDatabaseRequest } from './database-query-status.js'

const NAMESPACE_LIST = Symbol('namespace list')

export function useDatabaseMetadataExplorer({
  sessionId,
  connection,
  sqlEngine,
  onError
}) {
  const namespaces = ref([])
  const tableCache = reactive(new Map())
  const requests = shallowReactive(new Map())
  const namespacesLoading = computed(() => requests.has(NAMESPACE_LIST))
  const treeRevision = ref(0)
  let namespacesLoaded = false

  const namespaceKey = (objectRef) => getDatabaseObjectCacheKey({ connection, objectRef })
  const cachedTables = (key) => tableCache.get(key) || []

  const startRequest = (key, load) => {
    const previous = requests.get(key)
    const controller = new AbortController()
    const isCurrent = () => requests.get(key) === request
    const request = {
      controller,
      // Register before starting I/O, so overlapping callers can share this promise.
      promise: Promise.resolve().then(() => load(controller.signal, isCurrent)).finally(() => {
        if (isCurrent()) requests.delete(key)
      })
    }
    requests.set(key, request)
    previous?.controller.abort()
    return request.promise
  }

  const cancelRequests = () => {
    const pending = [...requests.values()]
    requests.clear()
    for (const { controller } of pending) controller.abort()
  }

  const reset = () => {
    namespacesLoaded = false
    cancelRequests()
    namespaces.value = []
    tableCache.clear()
    treeRevision.value += 1
  }

  const loadNamespaces = async ({ force = false } = {}) => {
    if (!force) {
      if (namespacesLoaded) return namespaces.value
      const pending = requests.get(NAMESPACE_LIST)
      if (pending) return pending.promise
    }

    return startRequest(NAMESPACE_LIST, async (signal, isCurrent) => {
      if (!isCurrent()) return namespaces.value
      try {
        const response = await sqlEngine.getDatabases({ sessionId, connection, signal })
        if (!isCurrent()) return namespaces.value
        const items = Array.isArray(response?.data?.databases) ? response.data.databases : []
        namespaces.value = items.map((item) => ({
          name: item.name || '',
          objectRef: normalizeDatabaseObjectRef(item.ref)
        }))
        namespacesLoaded = true
      } catch (error) {
        if (isCurrent() && !isCanceledDatabaseRequest(error)) {
          onError?.(error, '加载数据库结构失败')
        }
      }
      return namespaces.value
    })
  }

  const getTables = (objectRef) => cachedTables(namespaceKey(objectRef))
  const isTablesLoading = (objectRef) => requests.has(namespaceKey(objectRef))

  const loadTables = async (objectRef, { force = false } = {}) => {
    const namespaceRef = normalizeDatabaseObjectRef(objectRef)
    if (!namespaceRef.kind || (!namespaceRef.catalog && !namespaceRef.schema)) return []
    const key = namespaceKey(namespaceRef)
    if (!force) {
      if (tableCache.has(key)) return cachedTables(key)
      const pending = requests.get(key)
      if (pending) return pending.promise
    }

    return startRequest(key, async (signal, isCurrent) => {
      if (!isCurrent()) return cachedTables(key)
      try {
        const response = await sqlEngine.getTables({ sessionId, connection, objectRef: namespaceRef, signal })
        if (!isCurrent()) return cachedTables(key)
        const items = Array.isArray(response?.data?.tables) ? response.data.tables : []
        const tables = items.map((item) => ({
          name: item.name || '',
          schema: item.schema || '',
          comment: item.comment || '',
          objectRef: normalizeDatabaseObjectRef(item.ref)
        }))
        tableCache.set(key, tables)
        return tables
      } catch (error) {
        if (isCurrent() && !isCanceledDatabaseRequest(error)) {
          onError?.(error, `加载 ${namespaceRef.catalog || namespaceRef.schema} 的表列表失败`)
        }
        return cachedTables(key)
      }
    })
  }

  const refreshNamespaces = async () => {
    reset()
    return loadNamespaces({ force: true })
  }

  const refreshTables = async (objectRef) => {
    tableCache.delete(namespaceKey(objectRef))
    treeRevision.value += 1
    return loadTables(objectRef, { force: true })
  }

  if (getCurrentScope()) onScopeDispose(cancelRequests)

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
