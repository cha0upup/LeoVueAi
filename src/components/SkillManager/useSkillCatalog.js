import { computed, onScopeDispose, ref, watch } from 'vue'
import { getSkillHealthApi, getSkillTaxonomyApi, listSkillsApi, searchSkillsApi } from '@/services/api/skills.js'
import { showError } from '@/utils/messageUtils.js'

/** Read-side catalog state, debounce and request ownership, independent of table/workspace views. */
export function useSkillCatalog({ activeScope, scopes, onScopeLoaded, onSearchChanged }) {
  const scopeCatalog = ref(Object.fromEntries(scopes.map((scope) => [scope, []])))
  const pendingLoads = ref(0)
  const catalogLoading = computed(() => pendingLoads.value > 0)
  const searchKeyword = ref('')
  const searchResults = ref(null)
  const searchError = ref('')
  const searchLoading = ref(false)
  const taxonomy = ref({ domains: [], categories: [], modes: [], risks: [], accessModes: [], statuses: [] })
  const scopeRevisions = new Map()
  let timer = null
  let searchRevision = 0
  let taxonomyRevision = 0
  let healthRevision = 0
  let disposed = false

  const resetSearch = () => {
    clearTimeout(timer)
    timer = null
    searchRevision += 1
    searchResults.value = null
    searchError.value = ''
    searchLoading.value = false
  }

  const loadTaxonomy = async () => {
    if (disposed) return
    const revision = ++taxonomyRevision
    try {
      const response = await getSkillTaxonomyApi()
      if (!disposed && revision === taxonomyRevision) taxonomy.value = { ...taxonomy.value, ...(response.data || {}) }
    } catch (error) {
      if (!disposed && revision === taxonomyRevision) showError(error?.response?.data?.msg || '加载 Skill 分类字典失败')
    }
  }

  const loadScopeSkills = async (scope) => {
    if (disposed) return []
    const revision = (scopeRevisions.get(scope) || 0) + 1
    scopeRevisions.set(scope, revision)
    try {
      const response = await listSkillsApi(scope)
      const list = Array.isArray(response.data) ? response.data : []
      if (!disposed && scopeRevisions.get(scope) === revision) {
        scopeCatalog.value = { ...scopeCatalog.value, [scope]: list }
        onScopeLoaded?.(scope, list)
      }
      return list
    } catch (error) {
      if (!disposed && scopeRevisions.get(scope) === revision) throw error
      return []
    }
  }

  const loadSkills = async () => {
    const scope = activeScope.value
    try { await loadScopeSkills(scope) }
    catch (error) {
      if (!disposed && activeScope.value === scope) showError(error?.response?.data?.msg || '加载 Skill 列表失败')
    }
  }

  const loadHealth = async () => {
    if (disposed) return null
    const scope = activeScope.value, revision = ++healthRevision
    const current = () => !disposed && revision === healthRevision && scope === activeScope.value
    try {
      const response = await getSkillHealthApi(scope)
      return current() ? { data: response.data } : null
    } catch (error) {
      if (current()) showError(error?.response?.data?.msg || 'Skill 健康检查失败')
      return null
    }
  }

  const loadCatalog = async () => {
    if (disposed) return
    pendingLoads.value += 1
    try {
      const results = await Promise.allSettled(scopes.map(loadScopeSkills))
      const failure = results.find(result => result.status === 'rejected')
      if (failure && !disposed) showError(failure.reason?.response?.data?.msg || '加载 Skill Catalog 失败')
      return !disposed && !failure
    } finally {
      if (!disposed) pendingLoads.value -= 1
    }
  }

  watch(searchKeyword, (value) => {
    resetSearch()
    onSearchChanged?.()
    const normalized = value.trim()
    if (!normalized) return
    const revision = searchRevision
    const scope = activeScope.value
    const current = () => !disposed && revision === searchRevision && scope === activeScope.value
    searchResults.value = []
    timer = setTimeout(async () => {
      if (!current()) return
      timer = null
      searchLoading.value = true
      try {
        const response = await searchSkillsApi(scope, normalized)
        if (current()) searchResults.value = Array.isArray(response.data) ? response.data : []
      } catch (error) {
        if (current()) {
          searchResults.value = []
          searchError.value = error?.response?.data?.msg || '搜索失败，请重试'
        }
      } finally {
        if (current()) searchLoading.value = false
      }
    }, 350)
  }, { flush: 'sync' })
  watch(activeScope, () => {
    healthRevision += 1
    resetSearch()
    searchKeyword.value = ''
  }, { flush: 'sync' })
  onScopeDispose(() => { disposed = true; resetSearch(); pendingLoads.value = 0 })

  return {
    scopeCatalog, catalogLoading, searchKeyword, searchResults, searchError, searchLoading, taxonomy,
    loadTaxonomy, loadScopeSkills, loadSkills, loadCatalog, loadHealth
  }
}
