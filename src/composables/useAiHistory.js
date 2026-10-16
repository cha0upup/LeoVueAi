import { computed, nextTick, ref } from 'vue'
import {
  AI_HISTORY_PAGE_SIZE,
  fetchCompleteAiHistory,
  mergeAiHistoryRecords,
  normalizeAiHistoryPage,
  requireOlderCursor
} from './aiHistoryPagination.js'

/** 两类 AI 共用的历史翻页状态；翻页与实时事件游标互不影响。 */
export function useAiHistory({
  getConversationKey,
  getScopeKey = () => 'platform',
  loadPage,
  onPrepend,
  getScrollElement = () => null,
  onError = () => {}
}) {
  const pages = ref({})
  const context = (threadId = getConversationKey()) => {
    const scopeKey = getScopeKey()
    return { threadId, scopeKey, key: JSON.stringify([scopeKey, threadId]) }
  }
  const activePage = computed(() => pages.value[context().key])
  const hasOlderMessages = computed(() => Boolean(activePage.value?.hasMore))
  const loadingOlder = computed(() => Boolean(activePage.value?.loading))

  const recordPage = (threadId, response) => {
    const { key } = context(threadId)
    const page = normalizeAiHistoryPage(response)
    pages.value[key] = { ...page, loading: false }
  }

  const loadOlderMessages = async () => {
    const current = context()
    const page = pages.value[current.key]
    if (!current.threadId || !page?.hasMore || page.loading) return false
    page.loading = true
    const wrap = getScrollElement()
    const height = wrap?.scrollHeight || 0
    const top = wrap?.scrollTop || 0
    try {
      const beforeSequence = requireOlderCursor(page)
      const older = normalizeAiHistoryPage(await loadPage({
        ...current, beforeSequence, limit: AI_HISTORY_PAGE_SIZE
      }))
      if (context().key !== current.key || pages.value[current.key] !== page) return false
      if (older.hasMore) requireOlderCursor(older, beforeSequence)
      const records = mergeAiHistoryRecords([...older.messages, ...page.messages])
      onPrepend(records, current.threadId)
      Object.assign(page, older, { messages: records })
      await nextTick()
      if (context().key === current.key && wrap && wrap === getScrollElement()) {
        wrap.scrollTop = top + wrap.scrollHeight - height
      }
      return true
    } catch (error) {
      if (context().key === current.key) onError(error)
      return false
    } finally {
      page.loading = false
    }
  }

  const loadCompleteHistory = (threadId = getConversationKey()) => {
    const current = context(threadId)
    return fetchCompleteAiHistory(params => loadPage({ ...current, ...params }))
  }

  const forgetHistory = threadId => { delete pages.value[context(threadId).key] }

  return { recordPage, hasOlderMessages, loadingOlder, loadOlderMessages, loadCompleteHistory, forgetHistory }
}
