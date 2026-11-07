import { computed, ref, watch } from 'vue'
import { filterSkills, summarizeSkillCatalog } from './skillUiModel.js'

const choiceFields = [
  {
    key: 'availability', label: '运行可用性', chipLabel: '可用性', placeholder: '全部可用性',
    options: { runtime: '可进入运行目录', controlled: '受控启用', disabled: '已禁用',
      draft: '草稿', reviewed: '待发布', deprecated: '已弃用', invalid: '不可运行' }
  },
  {
    key: 'approval', label: '授权要求', chipLabel: '授权', placeholder: '全部', governance: true,
    options: { required: '需要显式授权', 'not-required': '不要求显式授权' }
  },
  {
    key: 'health', label: '健康状态', chipLabel: '健康', placeholder: '全部', governance: true,
    options: { problems: '存在问题', healthy: '健康', warning: '存在警告', invalid: '存在错误' }
  }
]

/** Pure catalog projections and filter lifecycle; all external effects are explicit callbacks. */
export function useSkillFilters({ skills, taxonomy, catalogMode, activeScope, searchKeyword, searchResults, onChange }) {
  const distinct = (key) => [...new Set(skills.value.flatMap(skill => skill[key] || []))].sort()
  const allFilterFields = computed(() => [
    {
      key: 'domain',
      label: '能力域',
      placeholder: '全部能力域',
      options: taxonomy.value.domains,
      governance: true
    },
    {
      key: 'category',
      label: '主分类',
      chipLabel: '分类',
      placeholder: '全部分类',
      options: distinct('category'),
      filterable: true
    },
    {
      key: 'pack',
      label: '能力包',
      placeholder: '全部能力包',
      options: distinct('pack'),
      filterable: true,
      governance: true
    },
    {
      key: 'platform',
      label: '平台',
      placeholder: '全部平台',
      options: distinct('platforms'),
      filterable: true
    },
    {
      key: 'risk',
      label: '风险',
      placeholder: '全部风险',
      options: taxonomy.value.risks
    },
    {
      key: 'accessMode',
      label: '访问模式',
      placeholder: '全部访问模式',
      options: taxonomy.value.accessModes,
      governance: true
    },
    {
      key: 'status',
      label: '生命周期',
      placeholder: '全部状态',
      options: taxonomy.value.statuses,
      governance: true
    },
    ...choiceFields.map(field => ({
      ...field, options: Object.entries(field.options).map(([value, label]) => ({ value, label }))
    }))
  ])
  const catalogFilterFields = computed(() => allFilterFields.value.filter(field =>
    catalogMode.value === 'governance' || !field.governance))
  const emptyFilters = () => Object.fromEntries(allFilterFields.value.map(field => [field.key, '']))
  const filters = ref(emptyFilters())
  const searchSource = computed(() => {
    if (!searchKeyword.value.trim()) return skills.value
    return Array.isArray(searchResults.value) ? searchResults.value : []
  })
  const filteredSkills = computed(() => filterSkills(searchSource.value, filters.value))
  const catalogSummary = computed(() => summarizeSkillCatalog(skills.value))
  const activeFilterEntries = computed(() => {
    const fields = Object.fromEntries(allFilterFields.value.map(field => [field.key, field]))
    return Object.entries(filters.value)
      .filter(([, value]) => Boolean(value))
      .map(([key, value]) => {
        const field = fields[key]
        const options = key === 'status' ? fields.availability.options : field?.options
        return { key, label: field?.chipLabel || field?.label || key,
          value: options?.find(option => option.value === value)?.label || value }
      })
  })
  const setFilter = (key, value) => {
    if (!allFilterFields.value.some(field => field.key === key)) return
    const normalized = value ?? ''
    if (Object.is(filters.value[key], normalized)) return
    filters.value = { ...filters.value, [key]: normalized }
  }

  const removeFilter = (key) => {
    setFilter(key, '')
  }

  const clearFilters = () => {
    filters.value = emptyFilters()
  }

  const applyQuickFilter = (kind) => {
    const next = emptyFilters()
    if (['runtime', 'controlled', 'draft'].includes(kind)) next.availability = kind
    else if (['problems', 'warning', 'invalid'].includes(kind)) next.health = kind
    filters.value = next
  }

  watch(filters, () => onChange?.(), { deep: true, flush: 'sync' })
  watch(activeScope, clearFilters, { flush: 'sync' })
  watch(catalogMode, (mode) => {
    if (mode !== 'simple') return
    const current = filters.value
    filters.value = {
      ...emptyFilters(),
      category: current.category,
      platform: current.platform,
      risk: current.risk,
      availability: current.availability,
      health: current.health === 'problems' ? 'problems' : ''
    }
  }, { flush: 'sync' })

  return {
    filters, filteredSkills, catalogSummary, catalogFilterFields, activeFilterEntries,
    setFilter, removeFilter, clearFilters, applyQuickFilter
  }
}
