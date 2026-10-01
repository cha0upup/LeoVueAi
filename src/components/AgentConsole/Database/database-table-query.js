export const DATABASE_FILTER_OPERATORS = Object.freeze([
  { label: '等于', value: 'eq' },
  { label: '不等于', value: 'ne' },
  { label: '包含（LIKE）', value: 'like' },
  { label: '大于', value: 'gt' },
  { label: '大于等于', value: 'gte' },
  { label: '小于', value: 'lt' },
  { label: '小于等于', value: 'lte' },
  { label: '属于列表（IN）', value: 'in' },
  { label: '不属于列表', value: 'not_in' },
  { label: '为空', value: 'is_null' },
  { label: '不为空', value: 'is_not_null' }
])

const OPERATOR_VALUES = new Set(DATABASE_FILTER_OPERATORS.map((item) => item.value))
const VALUELESS_OPERATORS = new Set(['is_null', 'is_not_null'])
const LIST_OPERATORS = new Set(['in', 'not_in'])
let filterSequence = 0

const nextFilterKey = () => `database-filter-${++filterSequence}`

export function createDatabaseFilterDraft(filter = {}) {
  const operator = OPERATOR_VALUES.has(filter.operator) ? filter.operator : 'eq'
  const value = Array.isArray(filter.value) ? filter.value.join(', ') : (filter.value ?? '')
  return {
    key: nextFilterKey(),
    field: filter.field || '',
    operator,
    value
  }
}

export function hydrateDatabaseFilterDrafts(filters = []) {
  const source = Array.isArray(filters) ? filters : []
  return source.length > 0
    ? source.map((filter) => createDatabaseFilterDraft(filter))
    : [createDatabaseFilterDraft()]
}

export function operatorNeedsValue(operator) {
  return !VALUELESS_OPERATORS.has(operator)
}

export function serializeDatabaseFilters(drafts = []) {
  if (!Array.isArray(drafts)) return []
  return drafts.flatMap((draft) => {
    if (!draft?.field || !String(draft.field).trim()) return []
    const operator = OPERATOR_VALUES.has(draft.operator) ? draft.operator : 'eq'
    const filter = { field: draft.field, operator }
    if (VALUELESS_OPERATORS.has(operator)) return [filter]
    if (LIST_OPERATORS.has(operator)) {
      filter.value = Array.isArray(draft.value)
        ? [...draft.value]
        : String(draft.value ?? '')
            .split(',')
            .map((value) => value.trim())
            .filter((value) => value !== '')
      return [filter]
    }
    filter.value = Object.hasOwn(draft, 'value') ? draft.value : ''
    return [filter]
  })
}

export function normalizeDatabaseOrderBy(orderBy = []) {
  if (!Array.isArray(orderBy)) return []
  return orderBy.flatMap((item) => {
    if (!item?.field || !String(item.field).trim()) return []
    return [{
      field: item.field,
      direction: String(item.direction).toUpperCase() === 'DESC' ? 'DESC' : 'ASC'
    }]
  })
}

export function normalizeDatabaseTableQuery({ filters = [], orderBy = [] } = {}) {
  return {
    filters: serializeDatabaseFilters(filters),
    orderBy: normalizeDatabaseOrderBy(orderBy)
  }
}
