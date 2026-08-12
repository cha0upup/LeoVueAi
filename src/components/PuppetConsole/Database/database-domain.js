export const DATABASE_OBJECT_KINDS = Object.freeze({
  CATALOG: 'catalog',
  SCHEMA: 'schema',
  TABLE: 'table',
  VIEW: 'view'
})

export function normalizeDatabaseObjectRef(source = {}, fallback = {}) {
  const value = source && typeof source === 'object' ? source : {}
  const fallbackValue = fallback && typeof fallback === 'object' ? fallback : {}
  return {
    catalog: String(value.catalog || fallbackValue.catalog || '').trim(),
    schema: String(value.schema || fallbackValue.schema || '').trim(),
    name: String(value.name || fallbackValue.name || '').trim(),
    kind: String(value.kind || fallbackValue.kind || '').trim()
  }
}

export function createNamespaceRef(name, namespaceLevels = []) {
  const normalizedName = String(name || '').trim()
  const levels = Array.isArray(namespaceLevels) ? namespaceLevels : []
  if (levels.includes(DATABASE_OBJECT_KINDS.SCHEMA) && !levels.includes(DATABASE_OBJECT_KINDS.CATALOG)) {
    return normalizeDatabaseObjectRef({ schema: normalizedName, kind: DATABASE_OBJECT_KINDS.SCHEMA })
  }
  return normalizeDatabaseObjectRef({ catalog: normalizedName, kind: DATABASE_OBJECT_KINDS.CATALOG })
}

export function createTableRef({ namespaceRef, table, schema = '', ref = null } = {}) {
  if (ref) return normalizeDatabaseObjectRef(ref, { name: table, kind: DATABASE_OBJECT_KINDS.TABLE })
  const namespace = normalizeDatabaseObjectRef(namespaceRef)
  return normalizeDatabaseObjectRef({
    catalog: namespace.catalog,
    schema: schema || namespace.schema,
    name: table,
    kind: DATABASE_OBJECT_KINDS.TABLE
  })
}

export function hasDatabaseCapability(config, capability) {
  return config?.capabilities?.[capability] === true
}

export function getDatabaseObjectLabel(ref, fallback = '') {
  const objectRef = normalizeDatabaseObjectRef(ref)
  return objectRef.name || objectRef.schema || objectRef.catalog || fallback
}

export function getDatabaseObjectCacheKey({ connection, database, table, objectRef }) {
  const ref = normalizeDatabaseObjectRef(objectRef)
  return JSON.stringify([
    connection?.connectionId || connection?.url || '',
    connection?.dialect || '',
    ref.kind || '',
    ref.catalog || '',
    ref.schema || '',
    ref.name || table || '',
    database || ''
  ])
}
