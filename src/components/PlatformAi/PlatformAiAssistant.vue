<template>
  <div class="platform-ai-assistant">
    <header class="assistant-header">
      <div class="assistant-identity">
        <span
          class="assistant-icon"
          aria-hidden="true"
        >
          <Icon :icon="icons.chatAi" />
        </span>
        <div class="assistant-heading">
          <strong>平台 AI</strong>
          <span>跨主机与平台资源分析</span>
        </div>
        <span
          class="assistant-status"
          :class="{ 'is-ready': agentReady }"
          role="status"
        >
          <span class="assistant-status__dot" />
          {{ agentReady ? '服务可用' : '初始化中' }}
        </span>
      </div>
      <div class="assistant-actions">
        <el-tooltip
          content="归档当前分析报告"
          placement="bottom"
          :show-after="400"
        >
          <button
            type="button"
            class="header-action"
            :disabled="!canArchiveReport || archivingReport"
            @click="archiveCurrentReport"
          >
            <el-icon :class="{ 'u-spin': archivingReport }">
              <Icon :icon="icons.save" />
            </el-icon>
            <span>归档</span>
          </button>
        </el-tooltip>
        <button
          type="button"
          class="header-action is-primary"
          :disabled="creatingThread"
          @click="onCreateThread"
        >
          <el-icon><Icon :icon="icons.plus" /></el-icon>
          <span>新对话</span>
        </button>
        <el-tooltip
          content="关闭平台 AI"
          placement="bottom"
          :show-after="400"
        >
          <button
            type="button"
            class="header-action is-icon"
            aria-label="关闭平台 AI"
            @click="$emit('close')"
          >
            <el-icon><Icon :icon="icons.close" /></el-icon>
          </button>
        </el-tooltip>
      </div>
    </header>

    <PlatformAiThreadTabs
      :model-value="activeThreadId"
      :threads="threads"
      :conversation-status="conversationStatus"
      @activate="onActivateThread"
      @delete="onDeleteThread"
      @rename="commitRename"
    />

    <PlanPopover
      v-if="latestPlan"
      :plan="latestPlan"
      variant="bar"
    />

    <!-- ── Chat body ─────────────────────────────────────────────────────── -->
    <div class="chat-body">
      <el-scrollbar
        ref="scrollbarRef"
        class="messages-scroll"
      >
        <div class="thread">
          <PlatformAiWelcome
            v-if="!messages.length && !historyLoading"
            :ready="agentReady"
            @pick-prompt="applyPrompt"
          />

          <div
            v-if="historyLoading"
            class="history-loading"
          >
            <span>加载历史消息…</span>
          </div>

          <template
            v-for="(msg, idx) in messages"
            :key="idx"
          >
            <AiAssistantTurnUser
              v-if="msg.role === 'user'"
              :content="msg.content"
              :timestamp="msg.timestamp"
              :attachments="msg.attachments"
            />
            <div
              v-else-if="msg.role === 'system-warn' || msg.role === 'system-info'"
              :class="msg.role === 'system-info' ? 'ai-system-info' : 'ai-system-warn'"
            >
              {{ msg.content }}
            </div>
            <AiAssistantTurnAssistant
              v-else
              :msg="msg"
              @retry="retry"
              @answer-user-input="answerUserInput"
            />
          </template>

          <div
            class="thread-spacer"
            aria-hidden="true"
          />
        </div>
      </el-scrollbar>

      <PlatformAiComposer
        :model-value="draft"
        :sending="composerSending"
        :ready="agentReady"
        :composing="composerComposing"
        :config-id="selectedConfigId"
        :reasoning-effort="reasoningEffort"
        :configs="configs"
        :attachments="attachments"
        :waiting-for-user-input="waitingForUserInput"
        @update:model-value="draft = $event"
        @update:config-id="onComposerConfigChange"
        @update:reasoning-effort="onReasoningEffortChange"
        @update:attachments="attachments = $event"
        @submit="onSend"
        @fab-click="onFabClick"
        @compositionstart="composerComposing = true"
        @compositionend="composerComposing = false"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

import { icons } from '@/utils/icons.js'
import {
  platformAiStartTurnApi,
  platformAiCreateAgent,
  platformAiStopApi,
  platformAiEventsApi,
  platformAiStreamApi,
  platformAiMessagesApi,
  platformAiSwitchChannelApi,
  platformAiThreadsApi,
  platformAiThreadCreateApi,
  platformAiThreadDeleteApi,
  platformAiThreadRenameApi,
  platformAiThreadActivateApi
} from '@/services/api/platform-ai.js'
import { useAiChat } from '@/composables/useAiChat.js'
import { useAiChannelSelector } from '@/composables/useAiChannelSelector.js'
import { ACTIVE_AI_STATUSES, normalizeAiStatus } from '@/utils/aiRuntime.js'
import PlatformAiWelcome from './PlatformAiWelcome.vue'
import PlatformAiComposer from './PlatformAiComposer.vue'
import PlatformAiThreadTabs from './PlatformAiThreadTabs.vue'
import AiAssistantTurnUser from '@/components/AiAssistant/AiAssistantTurnUser.vue'
import AiAssistantTurnAssistant from '@/components/AiAssistant/AiAssistantTurnAssistant.vue'
import PlanPopover from '@/components/AiAssistant/PlanPopover.vue'
import { showError, showSuccess } from '@/utils/messageUtils.js'
import { useAuth } from '@/composables/useAuth.js'
import {
  buildRequestAttachments,
  findLatestAssistantPlan,
  getPlatformThreadStatus,
  mapPlatformPersistedMessages
} from './platformAiAssistantModel.js'
import { createLatestRequestGuard } from '@/utils/latestRequestGuard.js'
import { createLogger } from '@/utils/logger.js'
import {
  ARTIFACT_CATEGORY,
  archiveTextArtifact,
  buildAiReportMarkdown
} from '@/utils/artifactArchive.js'

defineEmits(['close'])

const logger = createLogger('PlatformAiAssistant')
const requestGuard = createLatestRequestGuard(['threads', 'history', 'events', 'activate', 'config', 'init'])
const renameSequences = new Map()
let mounted = false
let statusSyncPromise = null

const { selectedConfigId, configs, fetchConfigs } = useAiChannelSelector()
const reasoningEffort = ref('medium')
const attachments = ref([])
const selectedConfigModel = computed(() => configs.value.find(c => c.id === selectedConfigId.value)?.model || '')
const requestedModelSwitchId = ref(null)
const revertingConfigSelection = ref(false)
const passiveConfigId = ref(null)

const onComposerConfigChange = (configId) => {
  requestedModelSwitchId.value = configId
  selectedConfigId.value = configId
}

const reasoningEffortLabels = { low: '低', medium: '中', high: '高', xhigh: '极高' }
const onReasoningEffortChange = (effort) => {
  if (!effort || effort === reasoningEffort.value) return
  reasoningEffort.value = effort
  messages.value.push({
    role: 'system-info',
    content: `推理强度已切换至 ${reasoningEffortLabels[effort] || effort}`,
    timestamp: Date.now()
  })
}
const { fetchAuth } = useAuth()

// ── Thread management ─────────────────────────────────────────────────────────
const threads = ref([])
const activeThreadId = ref(null)
const creatingThread = ref(false)
const historyLoading = ref(false)
const agentReady = ref(false)
const archivingReport = ref(false)

const activeThread = computed(() => {
  return threads.value.find(thread => thread.threadId === activeThreadId.value) || null
})

const syncSelectedConfigFromThread = (threadId) => {
  const configId = threads.value.find(t => t.threadId === threadId)?.configId
  if (configId != null && configId !== selectedConfigId.value && configs.value.some(c => c.id === configId)) {
    passiveConfigId.value = configId
    selectedConfigId.value = configId
  }
}

const latestPlan = computed(() => findLatestAssistantPlan(messages.value))

const commitRename = async ({ threadId, title }) => {
  const newTitle = String(title || '').trim()
  const thread = threads.value.find(t => t.threadId === threadId)
  if (!thread || newTitle === thread.title) return
  const oldTitle = thread.title
  const sequence = (renameSequences.get(threadId) || 0) + 1
  renameSequences.set(threadId, sequence)
  thread.title = newTitle
  try {
    await platformAiThreadRenameApi({ threadId, title: newTitle })
    if (renameSequences.get(threadId) === sequence) renameSequences.delete(threadId)
  } catch (e) {
    if (renameSequences.get(threadId) !== sequence || thread.title !== newTitle) return
    renameSequences.delete(threadId)
    thread.title = oldTitle
    if (mounted) showError('重命名失败：' + (e?.message || '未知错误'))
  }
}

const getTabStatus = thread => getPlatformThreadStatus(thread, conversationStatus.value)

// ── AI chat ───────────────────────────────────────────────────────────────────
const {
  messages,
  draft,
  sending,
  composerComposing,
  scrollbarRef,
  conversationStatus,
  send,
  answerUserInput: answerUserInputViaChat,
  stopGeneration,
  setMessages,
  hasLocalMessages,
  isConversationSending,
  resumeConversationStream,
  disconnectConversationStream,
  disconnectAllConversationStreams,
  applyPrompt,
  retry
} = useAiChat({
  enqueueApi: (params) => platformAiStartTurnApi(params),
  stopApi: (params) => platformAiStopApi(params),
  recoverEventsApi: (params) => platformAiEventsApi(params).then(res => res.data),
  subscribeApi: (params) => platformAiStreamApi(params),
  onComplete: () => {
    if (mounted) fetchThreadsSilently()
  },
  canSend: () => agentReady.value && !!activeThreadId.value,
  getExtraParams: (threadId) => ({
    threadId: threadId || activeThreadId.value,
    configId: selectedConfigId.value ?? undefined
  }),
  getConversationKey: () => activeThreadId.value || 'default',
  errorLabel: '平台 AI 请求失败'
})

const composerSending = computed(() => {
  const localStatus = normalizeAiStatus(
    conversationStatus.value?.[activeThreadId.value]?.status || 'idle'
  )
  // 中断请求已被服务端接收后立即重新开放输入；下一条消息进入串行队列。
  if (localStatus === 'cancelling') return false
  if (sending.value || sendPreparing.value) return true
  const status = getTabStatus(activeThread.value)
  return ACTIVE_AI_STATUSES.includes(status)
})

const waitingForUserInput = computed(() => Boolean(
  conversationStatus.value?.[activeThreadId.value]?.pendingUserInput
))

const canArchiveReport = computed(() => {
  return !composerSending.value && messages.value.some(message => message?.role === 'assistant')
})

const archiveCurrentReport = async () => {
  if (!canArchiveReport.value || archivingReport.value) return
  const title = activeThread.value?.title || '平台 AI 分析'
  archivingReport.value = true
  try {
    await archiveTextArtifact({
      category: ARTIFACT_CATEGORY.AI_REPORTS,
      name: `平台-${title}`,
      extension: 'md',
      mimeType: 'text/markdown;charset=utf-8',
      content: buildAiReportMarkdown({
        title,
        scope: '平台 AI 分析',
        threadId: activeThreadId.value,
        model: selectedConfigModel.value,
        messages: messages.value
      })
    })
    showSuccess('分析报告已归档到成果库')
  } catch (error) {
    showError('归档分析报告失败：' + (error?.message || '未知错误'))
  } finally {
    archivingReport.value = false
  }
}

// ── Thread API ────────────────────────────────────────────────────────────────

const normalizeThreadList = response => {
  const value = response?.data ?? []
  return Array.isArray(value) ? value : []
}

const fetchThreads = async ({ silent = false } = {}) => {
  const sequence = requestGuard.next('threads')
  try {
    const response = await platformAiThreadsApi()
    if (!mounted || !requestGuard.isCurrent('threads', sequence)) return null
    const localById = new Map(threads.value.map(thread => [thread.threadId, thread]))
    const nextThreads = normalizeThreadList(response).map(thread => {
      const pendingRename = renameSequences.has(thread.threadId)
      return pendingRename ? { ...thread, title: localById.get(thread.threadId)?.title ?? thread.title } : thread
    })
    threads.value = nextThreads
    if (!nextThreads.some(thread => thread.threadId === activeThreadId.value)) {
      activeThreadId.value = nextThreads[0]?.threadId || null
      if (activeThreadId.value) syncSelectedConfigFromThread(activeThreadId.value)
      else setMessages([])
    }
    return nextThreads
  } catch (error) {
    if (!silent && mounted && requestGuard.isCurrent('threads', sequence)) {
      showError('加载线程列表失败：' + (error?.message || '未知错误'))
    }
    return null
  }
}

const fetchThreadsSilently = () => fetchThreads({ silent: true })

const shouldRecoverThreadProgress = threadId => {
  const thread = threads.value.find(item => item.threadId === threadId)
  const localState = conversationStatus.value?.[threadId]
  const status = normalizeAiStatus(localState?.status || thread?.runStatus || 'idle')
  return ACTIVE_AI_STATUSES.includes(status) ||
    status === 'waiting_for_user' ||
    !!localState?.pendingUserInput ||
    !!thread?.executing ||
    !!localState?.sending ||
    !!localState?.recovering
}

const recoverActiveThreadProgress = async ({ force = false, allowDuringHistoryLoading = false } = {}) => {
  const threadId = activeThreadId.value
  if (!threadId || (historyLoading.value && !allowDuringHistoryLoading)) return false
  if (!force && !shouldRecoverThreadProgress(threadId)) return false
  return resumeConversationStream({
    key: threadId,
    isCurrent: () => mounted && threadId === activeThreadId.value
  })
}

const syncThreadStatuses = async () => {
  if (!mounted) return
  if (statusSyncPromise) return statusSyncPromise
  const request = (async () => {
    const currentThreadId = activeThreadId.value
    const result = await fetchThreadsSilently()
    if (!result || !mounted) return
    if (activeThreadId.value !== currentThreadId && activeThreadId.value) {
      const threadId = activeThreadId.value
      const sequence = requestGuard.next('activate')
      try {
        await platformAiThreadActivateApi({ threadId })
      } catch {
        return
      }
      if (!mounted || !requestGuard.isCurrent('activate', sequence) || threadId !== activeThreadId.value) return
      await loadThreadHistory(threadId)
      return
    }
    await recoverActiveThreadProgress()
  })()
  statusSyncPromise = request
  try {
    return await request
  } finally {
    if (statusSyncPromise === request) statusSyncPromise = null
  }
}

const scrollToBottom = () => {
  nextTick(() => scrollbarRef.value?.setScrollTop?.(Number.MAX_SAFE_INTEGER))
}

const loadThreadHistory = async threadId => {
  const sequence = requestGuard.next('history')
  historyLoading.value = false
  if (!threadId) {
    setMessages([])
    return
  }
  if (isConversationSending(threadId) || hasLocalMessages(threadId)) {
    scrollToBottom()
    return
  }
  historyLoading.value = true
  try {
    const response = await platformAiMessagesApi({ threadId, offset: 0, limit: 50 })
    if (!mounted || !requestGuard.isCurrent('history', sequence) || threadId !== activeThreadId.value) return
    if (isConversationSending(threadId) || hasLocalMessages(threadId)) return
    const serverMessages = response.data?.messages ?? []
    setMessages(mapPlatformPersistedMessages(serverMessages), threadId)
    await recoverActiveThreadProgress({ allowDuringHistoryLoading: true })
    if (requestGuard.isCurrent('history', sequence) && threadId === activeThreadId.value) scrollToBottom()
  } catch (error) {
    if (requestGuard.isCurrent('history', sequence) && threadId === activeThreadId.value) {
      logger.warn(`加载平台 AI 线程历史失败 threadId=${threadId}: ${error?.message}`)
    }
  } finally {
    if (requestGuard.isCurrent('history', sequence)) historyLoading.value = false
  }
}

const onActivateThread = async threadId => {
  if (!threadId || threadId === activeThreadId.value) return
  const previousThreadId = activeThreadId.value
  if (previousThreadId) disconnectConversationStream(previousThreadId)
  const sequence = requestGuard.next('activate')
  try {
    await platformAiThreadActivateApi({ threadId })
    if (!mounted || !requestGuard.isCurrent('activate', sequence)) return
    if (!threads.value.some(thread => thread.threadId === threadId)) return
    activeThreadId.value = threadId
    syncSelectedConfigFromThread(threadId)
    await loadThreadHistory(threadId)
  } catch (error) {
    if (mounted && requestGuard.isCurrent('activate', sequence)) {
      showError('切换线程失败：' + (error?.message || '未知错误'))
    }
  }
}

const onCreateThread = async () => {
  if (creatingThread.value) return null
  creatingThread.value = true
  try {
    const response = await platformAiThreadCreateApi({ configId: selectedConfigId.value ?? undefined })
    if (!mounted) return null
    const info = response.data
    if (!info?.threadId) return null
    requestGuard.invalidate(['threads', 'history', 'events', 'activate'])
    const thread = {
      threadId: info.threadId,
      title: info.title || '新对话',
      configId: info.configId ?? selectedConfigId.value ?? null,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      messageCount: 0,
      runStatus: 'idle',
      executing: false
    }
    threads.value = [thread, ...threads.value.filter(item => item.threadId !== info.threadId)]
    activeThreadId.value = info.threadId
    setMessages([], info.threadId)
    return info.threadId
  } catch (error) {
    if (mounted) showError('创建线程失败：' + (error?.message || '未知错误'))
    return null
  } finally {
    creatingThread.value = false
  }
}

const onDeleteThread = async threadId => {
  if (!threadId) return
  if (composerSending.value && threadId === activeThreadId.value) await stopGeneration()
  try {
    await platformAiThreadDeleteApi({ threadId })
    if (!mounted) return
    requestGuard.invalidate(['threads', 'history', 'events', 'activate'])
    renameSequences.delete(threadId)
    const wasActive = activeThreadId.value === threadId
    threads.value = threads.value.filter(thread => thread.threadId !== threadId)
    if (!wasActive) return
    const nextThreadId = threads.value[0]?.threadId || null
    activeThreadId.value = nextThreadId
    if (!nextThreadId) {
      setMessages([])
      return
    }
    syncSelectedConfigFromThread(nextThreadId)
    const sequence = requestGuard.next('activate')
    await platformAiThreadActivateApi({ threadId: nextThreadId })
    if (mounted && requestGuard.isCurrent('activate', sequence) && nextThreadId === activeThreadId.value) {
      await loadThreadHistory(nextThreadId)
    }
  } catch (error) {
    if (mounted) showError('删除线程失败：' + (error?.message || '未知错误'))
  }
}

const sendPreparing = ref(false)
const onSend = async () => {
  if (waitingForUserInput.value) return
  const inputText = draft.value?.trim() || ''
  const text = inputText || (attachments.value.length ? '请阅读并分析附件。' : '')
  if (!text || composerSending.value || sendPreparing.value) return
  sendPreparing.value = true
  try {
    const threadId = activeThreadId.value || await onCreateThread()
    if (!threadId || !mounted || threadId !== activeThreadId.value) return
    const sequence = requestGuard.next('activate')
    try {
      await platformAiThreadActivateApi({ threadId })
    } catch (error) {
      if (mounted && threadId === activeThreadId.value) {
        showError('激活对话线程失败：' + (error?.message || '未知错误'))
      }
      return
    }
    if (!mounted || !requestGuard.isCurrent('activate', sequence) || threadId !== activeThreadId.value) return

    const requestAttachments = buildRequestAttachments(attachments.value)
    const displayAttachments = requestAttachments.map(({ name, mimeType, size }) => ({ name, mimeType, size }))
    attachments.value = []
    send({
      text,
      displayText: inputText,
      attachments: displayAttachments,
      requestParams: { reasoningEffort: reasoningEffort.value, attachments: requestAttachments }
    })
  } finally {
    sendPreparing.value = false
  }
}

const answerUserInput = ({ questionId, answer }) => {
  if (!questionId || !answer || composerSending.value) return
  return answerUserInputViaChat({ questionId, answer })
}

const onFabClick = async () => {
  if (composerSending.value) await stopGeneration()
  else onSend()
}

// ── Watchers ─────────────────────────────────────────────────────────────────

watch(selectedConfigId, async (newId, oldId) => {
  if (passiveConfigId.value === newId) {
    passiveConfigId.value = null
    return
  }
  passiveConfigId.value = null
  if (revertingConfigSelection.value) {
    revertingConfigSelection.value = false
    return
  }
  const userRequested = requestedModelSwitchId.value === newId
  requestedModelSwitchId.value = null
  if (!agentReady.value || !activeThreadId.value || newId === oldId || newId == null) return
  const threadId = activeThreadId.value
  const sequence = requestGuard.next('config')
  try {
    await platformAiSwitchChannelApi({ threadId, configId: newId })
    if (!mounted || !requestGuard.isCurrent('config', sequence) || threadId !== activeThreadId.value) return
    if (userRequested) {
      const config = configs.value.find(item => item.id === newId)
      const modelName = config?.model || config?.name || `#${newId}`
      messages.value.push({ role: 'system-info', content: `模型已切换至 ${modelName}`, timestamp: Date.now() })
    }
  } catch (e) {
    if (!mounted || !requestGuard.isCurrent('config', sequence) || threadId !== activeThreadId.value) return
    revertingConfigSelection.value = true
    selectedConfigId.value = oldId
    showError('切换 AI 通道失败：' + (e?.message || '未知错误'))
  }
})

watch(
  () => messages.value.length,
  () => { nextTick(() => scrollbarRef.value?.setScrollTop?.(999999)) }
)

// ── Thread status polling ────────────────────────────────────────────────────
let threadStatusTimer = null
const onVisibilityChange = () => {
  if (!document.hidden) syncThreadStatuses()
}

const onNetworkOnline = () => {
  syncThreadStatuses()
}

const initializePlatformAi = async () => {
  const sequence = requestGuard.next('init')
  try {
    await fetchAuth()
    if (!mounted || !requestGuard.isCurrent('init', sequence)) return
    await fetchConfigs()
    if (!mounted || !requestGuard.isCurrent('init', sequence)) return
    let loadedThreads = await fetchThreads()
    if (!mounted || !requestGuard.isCurrent('init', sequence) || !loadedThreads) return
    if (loadedThreads.length === 0) {
      await platformAiCreateAgent({ configId: selectedConfigId.value ?? undefined })
      if (!mounted || !requestGuard.isCurrent('init', sequence)) return
      loadedThreads = await fetchThreads()
      if (!mounted || !requestGuard.isCurrent('init', sequence) || !loadedThreads) return
    }
    agentReady.value = true
    const threadId = activeThreadId.value
    if (!threadId) return
    syncSelectedConfigFromThread(threadId)
    try {
      await platformAiThreadActivateApi({ threadId })
    } catch (error) {
      logger.warn(`激活平台 AI 初始线程失败 threadId=${threadId}: ${error?.message}`)
    }
    if (!mounted || !requestGuard.isCurrent('init', sequence) || threadId !== activeThreadId.value) return
    await loadThreadHistory(threadId)
  } catch (error) {
    if (mounted && requestGuard.isCurrent('init', sequence)) {
      showError('平台 AI 初始化失败：' + (error?.message || '未知错误'))
    }
  }
}

onMounted(() => {
  mounted = true
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('online', onNetworkOnline)
  threadStatusTimer = window.setInterval(() => {
    if (document.hidden) return
    const hasActiveWork = threads.value.some(t => {
      const s = normalizeAiStatus(t.runStatus || 'idle')
      return ACTIVE_AI_STATUSES.includes(s) || s === 'waiting_for_user'
    })
    if (!hasActiveWork && !sending.value) return
    syncThreadStatuses()
  }, 5000)

  initializePlatformAi()
})

onUnmounted(() => {
  mounted = false
  agentReady.value = false
  requestGuard.invalidate()
  renameSequences.clear()
  statusSyncPromise = null
  document.removeEventListener('visibilitychange', onVisibilityChange)
  window.removeEventListener('online', onNetworkOnline)
  if (threadStatusTimer) {
    clearInterval(threadStatusTimer)
    threadStatusTimer = null
  }
  disconnectAllConversationStreams()
  // 关闭面板只结束当前订阅视图，不向后端发送 stop；重新打开后通过事件补拉恢复。
})
</script>

<style scoped>
.platform-ai-assistant {
  --thread-max: 46rem;
  --accent: var(--el-color-primary);
  --accent-soft: var(--el-color-primary);
  --surface-border: var(--app-surface-border-strong);
  --ai-muted-surface: var(--app-surface-background);

  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background:
    radial-gradient(circle at 82% 0%, color-mix(in srgb, var(--el-color-primary) 5%, transparent), transparent 30%),
    var(--app-container-background);
}

.assistant-header {
  min-height: 60px;
  padding: 0 14px 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
  background: var(--app-container-background);
  border-bottom: 1px solid var(--app-divider-color);
}

.assistant-identity,
.assistant-actions,
.header-action {
  display: flex;
  align-items: center;
}

.assistant-identity {
  min-width: 0;
  gap: 9px;
}

.assistant-icon {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 11px;
  color: var(--el-color-primary);
  background: var(--app-selected-background);
  font-size: 18px;
}

.assistant-heading {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.assistant-heading strong {
  color: var(--el-text-color-primary);
  font-size: 15px;
  line-height: 1.25;
}

.assistant-heading span {
  color: var(--el-text-color-secondary);
  font-size: 11px;
  line-height: 1.25;
  white-space: nowrap;
}

.assistant-status {
  height: 22px;
  padding: 0 7px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
  border-radius: var(--radius-tag);
  color: var(--el-text-color-secondary);
  background: var(--app-control-background-soft);
  font-size: 11px;
}

.assistant-status__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--el-text-color-placeholder);
}

.assistant-status.is-ready {
  color: var(--el-color-success-dark-2);
}

.assistant-status.is-ready .assistant-status__dot {
  background: var(--el-color-success);
}

.assistant-actions {
  gap: 6px;
  flex-shrink: 0;
}

.header-action {
  height: 28px;
  padding: 0 9px;
  justify-content: center;
  gap: 5px;
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--el-text-color-regular);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: color var(--motion-fast), border-color var(--motion-fast), background var(--motion-fast);
}

.header-action:hover:not(:disabled) {
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 7%, transparent);
}

.header-action:focus-visible {
  outline: 2px solid var(--el-color-primary-light-5);
  outline-offset: 1px;
}

.header-action.is-primary {
  color: var(--el-color-white);
  background: var(--el-color-primary);
}

.header-action.is-primary:hover:not(:disabled) {
  color: var(--el-color-white);
  background: var(--el-color-primary-light-3);
}

.header-action.is-icon {
  width: 28px;
  padding: 0;
  border-color: transparent;
  background: transparent;
}

.header-action:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* ── Chat body ─────────────────────────────────────────────────────────────── */

.chat-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.messages-scroll {
  flex: 1;
  min-height: 0;
}

.messages-scroll :deep(.el-scrollbar__bar.is-vertical) {
  width: 6px;
}

.thread {
  min-height: 100%;
  max-width: var(--thread-max);
  width: 100%;
  box-sizing: border-box;
  margin: 0 auto;
  padding: 10px 16px 0;
  display: flex;
  flex-direction: column;
}

.thread-spacer {
  height: 12px;
}

.history-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 0;
  font-size: 13px;
  color: var(--el-text-color-placeholder);
}

.ai-system-warn {
  margin: 6px 0;
  padding: 7px 14px;
  border-radius: 8px;
  background: var(--el-color-warning-light-9);
  border: 0;
  color: var(--el-color-warning-dark-2);
  font-size: 13px;
  text-align: center;
}

.ai-system-info {
  width: fit-content;
  margin: 6px auto;
  padding: 5px 12px;
  border-radius: var(--radius-tag);
  color: var(--el-text-color-secondary);
  background: var(--app-control-background-soft);
  font-size: 12px;
  text-align: center;
}

@media (max-width: 768px) {
  .assistant-heading span,
  .assistant-status,
  .header-action span {
    display: none;
  }

  .header-action {
    width: 28px;
    padding: 0;
  }

  .thread {
    padding: 0 8px;
    max-width: 100%;
  }
}
</style>
