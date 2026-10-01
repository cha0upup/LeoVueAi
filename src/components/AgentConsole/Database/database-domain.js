export const DATABASE_OBJECT_KINDS = Object.freeze({
  CATALOG: 'catalog',
  SCHEMA: 'schema',
  TABLE: 'table',
  VIEW: 'view'
})

export function normalizeDatabaseObjectRef(source = {}) {
  const value = source && typeof source === 'object' ? source : {}
  return {
    catalog: String(value.catalog || '').trim(),
    schema: String(value.schema || '').trim(),
    name: String(value.name || '').trim(),
    kind: String(value.kind || '').trim()
  }
}

export function getDatabaseObjectLabel(ref, fallback = '') {
  const objectRef = normalizeDatabaseObjectRef(ref)
  return objectRef.name || objectRef.schema || objectRef.catalog || fallback
}

export function getDatabaseObjectCacheKey({ connection, objectRef }) {
  const ref = normalizeDatabaseObjectRef(objectRef)
  return JSON.stringify([
    connection?.connectionId || '',
    connection?.dialect || '',
    ref.kind || '',
    ref.catalog || '',
    ref.schema || '',
    ref.name || ''
  ])
}
