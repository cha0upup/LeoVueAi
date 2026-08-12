import { ref, computed } from 'vue'
import {
  puppetNodeAiThreadListApi,
  puppetNodeAiThreadCreateApi,
  puppetNodeAiThreadDeleteApi,
  puppetNodeAiThreadRenameApi,
  puppetNodeAiThreadMessagesApi,
  puppetNodeAiThreadEventsApi
} from '@/services/api.js'
import { showError } from '@/utils/messageUtils.js'
import { createLogger } from '@/utils/logger.js'
import { createLatestRequestGuard } from '@/utils/latestRequestGuard.js'

const logger = createLogger('AiThreads')

/**
 * AI 对话线程管理 composable。
 *
 * 负责线程列表的加载、创建、删除、重命名，以及历史消息的加载。
 * 与 useAiChat 配合使用：useAiThreads 管理线程元数据，useAiChat 管理当前线程的消息流。
 *
 * @param {object} opts
 * @param {import('vue').Ref<string>} opts.sessionId - PuppetNode 会话 ID
 */
export function useAiThreads({ sessionId }) {
  const threads        = ref([])   // AiThreadMeta[]
  const activeThreadId = ref(null) // string | null
  const loading        = ref(false)
  const requestGuard = createLatestRequestGuard(['threads'])
  let loadingSequence = 0

  // ── 线程列表 ──────────────────────────────────────────────────────────────

  const mergeThreadList = (serverThreads) => {
    const currentById = new Map(threads.value.map(thread => [thread.threadId, thread]))
    return serverThreads.map(serverThread => ({
      ...(currentById.get(serverThread.threadId) || {}),
      ...serverThread
    }))
  }

  const fetchThreads = async ({ preserveActive = false, silent = false } = {}) => {
    if (!sessionId.value) return
    const requestSessionId = sessionId.value
    const sequence = requestGuard.next('threads')
    const currentLoadingSequence = silent ? null : ++loadingSequence
    if (!silent) loading.value = true
    try {
      const res = await puppetNodeAiThreadListApi({ sessionId: requestSessionId })
      if (!requestGuard.isCurrent('threads', sequence) || requestSessionId !== sessionId.value) return
      const serverThreads = Array.isArray(res.data?.threads) ? res.data.threads : []
      threads.value = preserveActive ? mergeThreadList(serverThreads) : serverThreads

      if (!preserveActive) {
        activeThreadId.value = res.data?.activeThreadId ?? null
      } else if (!threads.value.some(thread => thread.threadId === activeThreadId.value)) {
        activeThreadId.value = res.data?.activeThreadId ?? threads.value[0]?.threadId ?? null
      }
      // 若服务端没有活跃线程，默认选第一个
      if (!activeThreadId.value && threads.value.length > 0) {
        activeThreadId.value = threads.value[0].threadId
      }
    } catch (e) {
      if (!silent && requestGuard.isCurrent('threads', sequence)) {
        showError('加载线程列表失败：' + (e?.message || '未知错误'))
      }
    } finally {
      if (!silent && currentLoadingSequence === loadingSequence) loading.value = false
    }
  }

  const refreshThreadStatuses = () => fetchThreads({ preserveActive: true, silent: true })

  // ── 创建线程 ──────────────────────────────────────────────────────────────

  /**
   * 创建新线程，返回新线程信息。
   * @param {object} [opts]
   * @param {string} [opts.title]    - 线程标题（可选，服务端自动生成）
   * @param {number} [opts.configId] - AI 通道 ID（可选）
   * @returns {Promise<{threadId: string, title: string, reconSummaryLoaded: boolean}>}
   */
  const createThread = async ({ title, configId } = {}) => {
    if (!sessionId.value) return null
    const requestSessionId = sessionId.value
    try {
      const res = await puppetNodeAiThreadCreateApi({
        sessionId: requestSessionId,
        title,
        configId
      })
      if (requestSessionId !== sessionId.value) return null
      requestGuard.invalidate(['threads'])
      const info = res.data
      // 追加到列表头部
      threads.value.unshift({
        threadId:     info.threadId,
        title:        info.title,
        createdAt:    Date.now(),
        lastActiveAt: Date.now(),
        messageCount: 0,
        runStatus: 'idle',
        executing: false,
        inMemory:     true
      })
      activeThreadId.value = info.threadId
      return info
    } catch (e) {
      if (requestSessionId === sessionId.value) {
        showError('创建线程失败：' + (e?.message || '未知错误'))
      }
      return null
    }
  }

  // ── 删除线程 ──────────────────────────────────────────────────────────────

  const deleteThread = async (threadId) => {
    if (!sessionId.value || !threadId) return
    const requestSessionId = sessionId.value
    try {
      await puppetNodeAiThreadDeleteApi({ sessionId: requestSessionId, threadId })
      if (requestSessionId !== sessionId.value) return
      requestGuard.invalidate(['threads'])
      threads.value = threads.value.filter(t => t.threadId !== threadId)
      // 若删除的是活跃线程，切换到第一个
      if (activeThreadId.value === threadId) {
        activeThreadId.value = threads.value.length > 0 ? threads.value[0].threadId : null
      }
    } catch (e) {
      if (requestSessionId === sessionId.value) {
        showError('删除线程失败：' + (e?.message || '未知错误'))
      }
    }
  }

  // ── 重命名线程 ────────────────────────────────────────────────────────────

  const renameThread = async (threadId, title) => {
    if (!sessionId.value || !threadId || !title?.trim()) return
    const requestSessionId = sessionId.value
    try {
      await puppetNodeAiThreadRenameApi({ sessionId: requestSessionId, threadId, title: title.trim() })
      if (requestSessionId !== sessionId.value) return
      requestGuard.invalidate(['threads'])
      const t = threads.value.find(t => t.threadId === threadId)
      if (t) t.title = title.trim()
    } catch (e) {
      if (requestSessionId === sessionId.value) {
        showError('重命名失败：' + (e?.message || '未知错误'))
      }
    }
  }

  // ── 切换线程 ──────────────────────────────────────────────────────────────

  /** 切换活跃线程（仅更新本地状态，消息加载由调用方处理）。 */
  const switchThread = (threadId) => {
    if (!threadId || activeThreadId.value === threadId) return
    activeThreadId.value = threadId
  }

  // ── 加载历史消息 ──────────────────────────────────────────────────────────

  /**
   * 加载指定线程的历史消息。
   * @param {string} threadId
   * @param {number} [offset=0]
   * @param {number} [limit=50]
   * @returns {Promise<{messages: object[], total: number}>}
   */
  const loadMessages = async (threadId, offset = 0, limit = 50) => {
    if (!sessionId.value || !threadId) return { messages: [], total: 0 }
    const requestSessionId = sessionId.value
    try {
      const res = await puppetNodeAiThreadMessagesApi({
        sessionId: requestSessionId,
        threadId,
        offset,
        limit
      })
      if (requestSessionId !== sessionId.value) return { messages: [], total: 0, stale: true }
      return {
        messages: res.data?.messages ?? [],
        total:    res.data?.total    ?? 0
      }
    } catch (e) {
      if (requestSessionId === sessionId.value) {
        showError('加载历史消息失败：' + (e?.message || '未知错误'))
      }
      throw e
    }
  }

  const loadEvents = async (threadId, afterSeq = 0, limit = 200) => {
    if (!sessionId.value || !threadId) {
      logger.warn(`跳过事件加载 sessionId=${sessionId.value} threadId=${threadId}`)
      return { events: [], lastSeq: 0, runStatus: 'idle', executing: false }
    }
    const startedAt = Date.now()
    try {
      const res = await puppetNodeAiThreadEventsApi({
        sessionId: sessionId.value,
        threadId,
        afterSeq,
        limit
      })
      const events = res.data?.events ?? []
      const runStatus = res.data?.runStatus ?? 'idle'
      return {
        events,
        lastSeq: Number(res.data?.lastSeq ?? 0),
        runStatus,
        status: res.data?.status ?? runStatus,
        executing: !!res.data?.executing,
        activeTurn: res.data?.activeTurn ?? null,
        queuedTurns: Array.isArray(res.data?.queuedTurns)
          ? res.data.queuedTurns
          : [],
        pendingTurnCount: Number(res.data?.pendingTurnCount ?? 0),
        taskTimeoutAt: Number(res.data?.taskTimeoutAt ?? 0),
        stopReason: res.data?.stopReason ?? null
      }
    } catch (err) {
      // 快照读取失败必须交给线程订阅的重连循环处理，不能伪装成 idle。
      const code = err?.code || err?.response?.status || 'UNKNOWN'
      logger.error(`事件加载失败 threadId=${threadId} afterSeq=${afterSeq} code=${code} 耗时=${Date.now() - startedAt}ms message=${err?.message}`, err)
      throw err
    }
  }

  // ── 当前活跃线程对象 ──────────────────────────────────────────────────────

  const activeThread = computed(() =>
    threads.value.find(t => t.threadId === activeThreadId.value) ?? null
  )

  return {
    threads,
    activeThreadId,
    activeThread,
    loading,
    fetchThreads,
    refreshThreadStatuses,
    createThread,
    deleteThread,
    renameThread,
    switchThread,
    loadMessages,
    loadEvents
  }
}
