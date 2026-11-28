import { computed, getCurrentScope, nextTick, onScopeDispose, ref, shallowRef, watch } from 'vue'
import {
  AI_HISTORY_PAGE_SIZE,
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
  const pending = shallowRef(null)
  const context = (threadId = getConversationKey()) => {
    const scopeKey = getScopeKey()
    return { threadId, scopeKey, key: JSON.stringify([scopeKey, threadId]) }
  }
  const activePage = computed(() => pages.value[context().key])
  const hasOlderMessages = computed(() => Boolean(activePage.value?.hasMore))
  const loadingOlder = computed(() => pending.value?.key === context().key)

  const cancelPending = (key = pending.value?.key) => {
    const request = pending.value
    if (!request || request.key !== key) return
    pending.value = null
    request.controller.abort()
  }

  if (getCurrentScope()) {
    watch(() => context().key, () => cancelPending(), { flush: 'sync' })
    onScopeDispose(cancelPending)
  }

  const recordPage = (threadId, response) => {
    const { key } = context(threadId)
    const page = normalizeAiHistoryPage(response)
    cancelPending(key)
    pages.value[key] = page
  }

  const loadOlderMessages = async () => {
    const current = context()
    const page = pages.value[current.key]
    if (!current.threadId || !page?.hasMore || pending.value?.key === current.key) return false
    cancelPending()
    const request = { key: current.key, controller: new AbortController() }
    pending.value = request
    const isCurrent = () => pending.value === request && context().key === request.key
    const wrap = getScrollElement()
    const height = wrap?.scrollHeight || 0
    const top = wrap?.scrollTop || 0
    try {
      const beforeSequence = requireOlderCursor(page)
      const response = await loadPage({
        ...current, beforeSequence, limit: AI_HISTORY_PAGE_SIZE
      }, { signal: request.controller.signal })
      if (!isCurrent()) return false
      const older = normalizeAiHistoryPage(response)
      if (older.hasMore) requireOlderCursor(older, beforeSequence)
      const records = mergeAiHistoryRecords([...older.messages, ...page.messages])
      onPrepend(records, current.threadId)
      Object.assign(page, older, { messages: records })
      await nextTick()
      if (isCurrent() && wrap && wrap === getScrollElement()) {
        wrap.scrollTop = top + wrap.scrollHeight - height
      }
      return true
    } catch (error) {
      if (isCurrent()) onError(error)
      return false
    } finally {
      if (pending.value === request) pending.value = null
    }
  }

  const forgetHistory = (threadId) => {
    const { key } = context(threadId)
    cancelPending(key)
    delete pages.value[key]
  }

  return { recordPage, hasOlderMessages, loadingOlder, loadOlderMessages, forgetHistory }
}
