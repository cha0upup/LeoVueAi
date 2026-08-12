<template>
  <div
    class="puppet-ai-assistant"
    :class="{ 'is-dock-mode': dockMode }"
  >
    <header class="assistant-header">
      <div class="assistant-identity">
        <span
          class="assistant-icon"
          aria-hidden="true"
        >
          <Icon :icon="icons.chatAi" />
        </span>
        <div class="assistant-heading">
          <strong>节点 AI</strong>
          <span>当前会话执行与分析</span>
        </div>
        <span
          class="assistant-model"
          :title="selectedConfigModel"
        >{{ selectedConfigModel || '模型连接中' }}</span>
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
            aria-label="归档当前分析报告"
            :disabled="!canArchiveReport || archivingReport"
            @click="archiveCurrentReport"
          >
            <el-icon :class="{ 'u-spin': archivingReport }">
              <Icon :icon="icons.save" />
            </el-icon>
          </button>
        </el-tooltip>
        <el-tooltip
          content="新建对话"
          placement="bottom"
          :show-after="400"
        >
          <button
            type="button"
            class="header-action is-primary"
            aria-label="新建对话"
            :disabled="creatingThread"
            @click="onCreateThread"
          >
            <el-icon><Icon :icon="icons.plus" /></el-icon>
          </button>
        </el-tooltip>
      </div>
    </header>

    <PuppetAiThreadTabs
      :model-value="activeThreadId"
      :threads="threads"
      :conversation-status="conversationStatus"
      @activate="onActivateThread"
      @delete="onDeleteThread"
    />

    <!-- ── Chat area ───────────────────────────────────────────────────────── -->
    <div class="chat-area">
      <PlanPopover
        v-if="latestPlan"
        :plan="latestPlan"
        variant="bar"
      />

      <div class="chat-body">
        <el-scrollbar
          ref="scrollbarRef"
          class="messages-scroll"
        >
          <div class="thread">
            <PuppetAiAssistantWelcome
              v-if="!messages.length && !historyLoading"
              :recon-summary-exists="reconSummaryExists"
              :basic-info="basicInfo"
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
                :session-id="sessionId"
                :thread-id="activeThreadId"
                @retry="retry"
                @apply-action="applyAction"
                @answer-user-input="answerUserInput"
              />
            </template>

            <div
              class="thread-spacer"
              aria-hidden="true"
            />
          </div>
        </el-scrollbar>

        <PuppetAiAssistantComposer
          v-model="draft"
          :sending="composerSending"
          :session-id="sessionId"
          :composing="composerComposing"
          :history="sentHistory"
          :config-id="selectedConfigId"
          :reasoning-effort="reasoningEffort"
          :configs="configs"
          :attachments="attachments"
          :waiting-for-user-input="waitingForUserInput"
          @update:config-id="onComposerConfigChange"
          @update:reasoning-effort="onReasoningEffortChange"
          @update:attachments="attachments = $event"
          @fab-click="onComposerMainAction"
          @submit="onSend"
          @compositionstart="composerComposing = true"
          @compositionend="composerComposing = false"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, toRef, watch } from 'vue'
import {
  puppetNodeAiStartTurnApi,
  puppetNodeAiStopApi,
  puppetNodeAiThreadStreamApi,
  puppetNodeAiSwitchChannelApi,
  listAvailableAiModelsApi,
  getReconSummaryApi,
  generateReconSummaryDigestApi
} from '@/services/api.js'

import { useAiChat } from '@/composables/useAiChat.js'
import { useAiThreads } from '@/composables/useAiThreads.js'
import { useAiChannelSelector } from '@/composables/useAiChannelSelector.js'
import { useAppEvent, emitAppEvent } from '@/composables/useAppEvent.js'
import { ACTIVE_AI_STATUSES, normalizeAiStatus } from '@/utils/aiRuntime.js'
import { icons } from '@/utils/icons.js'
import PuppetAiAssistantWelcome from './PuppetAiAssistantWelcome.vue'
import PuppetAiThreadTabs from './PuppetAiThreadTabs.vue'
import AiAssistantTurnUser from '@/components/AiAssistant/AiAssistantTurnUser.vue'
import AiAssistantTurnAssistant from '@/components/AiAssistant/AiAssistantTurnAssistant.vue'
import PuppetAiAssistantComposer from './PuppetAiAssistantComposer.vue'
import PlanPopover from '@/components/AiAssistant/PlanPopover.vue'
import { showError, showSuccess } from '@/utils/messageUtils.js'
import { createLogger } from '@/utils/logger.js'
import { createLatestRequestGuard } from '@/utils/latestRequestGuard.js'
import {
  buildRequestAttachments,
  findLatestAssistantPlan,
  mapPersistedThreadMessages
} from './puppetAiAssistantModel.js'
import {
  ARTIFACT_CATEGORY,
  archiveTextArtifact,
  buildAiReportMarkdown
} from '@/utils/artifactArchive.js'

const props = defineProps({
  sessionId: {
    type: String,
    required: true
  },
  /** 节点基础信息，透传给欢迎页动态选卡（可为 null） */
  basicInfo: {
    type: Object,
    default: null
  },
  initialPrompt: {
    type: String,
    default: ''
  },
  /** dock 模式：隐藏侧边线程栏，改用紧凑弹出层 */
  dockMode: {
    type: Boolean,
    default: false
  }
})

const logger = createLogger('PuppetAiAssistant')

// ── Thread management ─────────────────────────────────────────────────────────
const sessionIdRef = toRef(props, 'sessionId')

const {
  threads,
  activeThreadId,
  activeThread,
  fetchThreads,
  refreshThreadStatuses,
  createThread,
  deleteThread,
  switchThread,
  loadMessages,
  loadEvents
} = useAiThreads({ sessionId: sessionIdRef })

/** 正在执行中的线程 ID 集合（用于 tabs 状态指示灯）。 */
const busyThreadIds   = ref([])
/** 当前正在发送的线程 ID（用于 onComplete 回调中精确清除 busy 状态）。 */
const creatingThread  = ref(false)
const historyLoading  = ref(false)
const archivingReport = ref(false)
let threadStatusTimer = null
let statusSyncPromise = null
const sendingSessionsByThread = new Map()
const requestGuard = createLatestRequestGuard(['history', 'recon', 'config', 'init'])

// ── Channel selector ──────────────────────────────────────────────────────────
const { selectedConfigId, configs, fetchConfigs } = useAiChannelSelector({
  loadConfigs: listAvailableAiModelsApi
})
const reasoningEffort = ref('medium')
const attachments = ref([])
const selectedConfigModel = computed(() => configs.value.find(c => c.id === selectedConfigId.value)?.model || '')
const requestedModelSwitchId = ref(null)
const revertingConfigSelection = ref(false)
const syncingConfigSelection = ref(false)

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

const syncSelectedConfigFromThread = (threadId) => {
  const configId = threads.value.find(t => t.threadId === threadId)?.configId
  if (
    configId != null &&
    configId !== selectedConfigId.value &&
    configs.value.some(c => c.id === configId)
  ) {
    syncingConfigSelection.value = true
    selectedConfigId.value = configId
  }
}

// ── Recon summary badge ───────────────────────────────────────────────────────
const reconSummaryExists = ref(false)
const fetchReconSummaryStatus = async (sessionId = props.sessionId) => {
  if (!sessionId) return
  const sequence = requestGuard.next('recon')
  try {
    const res = await getReconSummaryApi({ sessionId })
    if (!requestGuard.isCurrent('recon', sequence) || sessionId !== props.sessionId) return
    reconSummaryExists.value = Boolean(String(res.data?.reconSummary || '').trim())
  } catch {
    if (requestGuard.isCurrent('recon', sequence) && sessionId === props.sessionId) {
      reconSummaryExists.value = false
    }
  }
}

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
  retry,
} = useAiChat({
  enqueueApi: (params) => puppetNodeAiStartTurnApi(params),
  stopApi:    (params) => puppetNodeAiStopApi(params),
  recoverEventsApi: (params) => loadEvents(params.threadId || activeThreadId.value, params.afterSeq, params.limit),
  subscribeApi: (params) => puppetNodeAiThreadStreamApi(params),
  onComplete: ({ key } = {}) => {
    const tid = key || [...sendingSessionsByThread.keys()].at(-1)
    const completedSessionId = sendingSessionsByThread.get(tid)
    if (tid) {
      busyThreadIds.value = busyThreadIds.value.filter(id => id !== tid)
      sendingSessionsByThread.delete(tid)
    }
    // Auto-generate recon summary digest after each AI turn completes
    if (completedSessionId && completedSessionId === props.sessionId) {
      generateReconSummaryDigestApi({ sessionId: completedSessionId })
        .then(() => {
          if (completedSessionId !== props.sessionId) return
          reconSummaryExists.value = true
          emitAppEvent('recon-summary-updated', { sessionId: completedSessionId, exists: true })
        })
        .catch(() => {/* non-fatal — digest runs best-effort */})
    }
  },
  canSend:        () => !!props.sessionId && !!activeThreadId.value,
  getExtraParams: (threadId) => ({
    sessionId: props.sessionId,
    threadId: threadId || activeThreadId.value,
    configId: selectedConfigId.value ?? undefined
  }),
  getConversationKey: () => activeThreadId.value || 'default',
  errorLabel: 'AI 对话请求失败'
})

const activeConversationStatus = computed(() =>
  activeThreadId.value ? (conversationStatus.value?.[activeThreadId.value] || {}) : {}
)

const waitingForUserInput = computed(() => Boolean(activeConversationStatus.value?.pendingUserInput))

const latestPlan = computed(() => findLatestAssistantPlan(messages.value))

const activeThreadBusy = computed(() => {
  const status = normalizeAiStatus(
    activeConversationStatus.value?.status ||
    activeThread.value?.runStatus ||
    'idle'
  )
  return (
    sending.value ||
    ACTIVE_AI_STATUSES.includes(status) ||
    !!activeThread.value?.executing
  )
})

const composerSending = computed(() =>
  normalizeAiStatus(activeConversationStatus.value?.status) === 'cancelling'
    ? false
    : activeThreadBusy.value
)

const canArchiveReport = computed(() => {
  return !composerSending.value && messages.value.some(message => message?.role === 'assistant')
})

const archiveCurrentReport = async () => {
  if (!canArchiveReport.value || archivingReport.value) return
  const hostName = props.basicInfo?.hostName || props.basicInfo?.hostname || props.sessionId
  const title = activeThread.value?.title || '节点 AI 分析'
  archivingReport.value = true
  try {
    await archiveTextArtifact({
      category: ARTIFACT_CATEGORY.AI_REPORTS,
      name: `节点-${hostName}-${title}`,
      extension: 'md',
      mimeType: 'text/markdown;charset=utf-8',
      content: buildAiReportMarkdown({
        title,
        scope: '节点 AI 分析',
        threadId: activeThreadId.value,
        sessionId: props.sessionId,
        hostName,
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

// ── Send history (Composer ↑ recall) ─────────────────────────────────────────
const sentHistory = ref([])
const MAX_HISTORY = 50

const ensureActiveThread = async () => {
  if (activeThreadId.value) return activeThreadId.value
  if (creatingThread.value) return null
  creatingThread.value = true
  try {
    const info = await createThread({ configId: selectedConfigId.value ?? undefined })
    if (!info?.threadId) return null
    setMessages([], info.threadId)
    return info.threadId
  } finally {
    creatingThread.value = false
  }
}

const onSend = async () => {
  if (waitingForUserInput.value) return
  const sessionId = props.sessionId
  const inputText = draft.value?.trim() || ''
  const text = inputText || (attachments.value.length ? '请阅读并分析附件。' : '')
  if (!text || composerSending.value) return
  draft.value = ''

  const threadId = await ensureActiveThread()
  if (sessionId !== props.sessionId) return
  if (!threadId) {
    draft.value = text
    showError('请先创建 AI 对话')
    return
  }

  if (text) {
    const idx = sentHistory.value.indexOf(text)
    if (idx >= 0) sentHistory.value.splice(idx, 1)
    sentHistory.value.push(text)
    if (sentHistory.value.length > MAX_HISTORY) sentHistory.value.shift()
  }
  // Capture which thread is sending so onComplete can clean up correctly
  if (!busyThreadIds.value.includes(threadId)) {
    busyThreadIds.value = [...busyThreadIds.value, threadId]
  }
  sendingSessionsByThread.set(threadId, sessionId)
  const requestAttachments = buildRequestAttachments(attachments.value)
  const displayText = inputText
  const displayAttachments = requestAttachments.map(({ name, mimeType, size }) => ({ name, mimeType, size }))
  attachments.value = []
  send({
    text,
    displayText,
    attachments: displayAttachments,
    requestParams: { reasoningEffort: reasoningEffort.value, attachments: requestAttachments }
  })
}

const answerUserInput = ({ questionId, answer }) => {
  if (!questionId || !answer || composerSending.value) return
  return answerUserInputViaChat({ questionId, answer })
}

const onComposerMainAction = async () => {
  if (composerSending.value) await stopActiveGeneration()
  else onSend()
}

const stopActiveGeneration = async () => {
  const threadId = activeThreadId.value
  if (!threadId) return
  const localBusy = sending.value || ACTIVE_AI_STATUSES.includes(
    normalizeAiStatus(activeConversationStatus.value?.status)
  )
  await stopGeneration()
  if (!localBusy) {
    puppetNodeAiStopApi({ sessionId: props.sessionId, threadId }).catch(() => {})
  }
  busyThreadIds.value = busyThreadIds.value.filter(id => id !== threadId)
}

/** 用户点击 TurnAssistant 中的建议卡片，直接以该建议文本发送 */
function applyAction(action) {
  if (!action || composerSending.value) return
  const text = typeof action === 'string' ? action : action.prompt || action.label
  if (!text) return
  draft.value = text
  onSend()
}

watch(
  () => props.initialPrompt,
  (value) => {
    const text = String(value || '').trim()
    if (text && !composerSending.value) {
      draft.value = text
    }
  },
  { immediate: true }
)

// ── Load thread history ───────────────────────────────────────────────────────
const scrollToBottom = () => {
  nextTick(() => scrollbarRef.value?.setScrollTop?.(Number.MAX_SAFE_INTEGER))
}

const loadThreadHistory = async (threadId) => {
  const sequence = requestGuard.next('history')
  const sessionId = props.sessionId
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
    const { messages: serverMessages } = await loadMessages(threadId, 0, 50)
    if (!requestGuard.isCurrent('history', sequence)) return
    if (sessionId !== props.sessionId || threadId !== activeThreadId.value) return
    if (isConversationSending(threadId) || hasLocalMessages(threadId)) return
    setMessages(mapPersistedThreadMessages(serverMessages), threadId)
    await recoverThreadProgress(threadId, { allowDuringHistoryLoading: true })
    if (requestGuard.isCurrent('history', sequence) && threadId === activeThreadId.value) {
      scrollToBottom()
    }
  } catch (error) {
    logger.warn(`加载线程历史失败 threadId=${threadId}: ${error?.message}`)
  } finally {
    if (requestGuard.isCurrent('history', sequence)) historyLoading.value = false
  }
}

// ── Thread actions ────────────────────────────────────────────────────────────
const onActivateThread = async (threadId) => {
  if (threadId === activeThreadId.value) return
  const previousThreadId = activeThreadId.value
  if (previousThreadId) disconnectConversationStream(previousThreadId)
  switchThread(threadId)
  syncSelectedConfigFromThread(threadId)
  await loadThreadHistory(threadId)
}

const onCreateThread = async () => {
  if (creatingThread.value) return
  creatingThread.value = true
  try {
    const info = await createThread({ configId: selectedConfigId.value ?? undefined })
    if (info) {
      setMessages([], info.threadId)
    }
  } finally {
    creatingThread.value = false
  }
}

const onDeleteThread = async (threadId) => {
  // If deleting the active thread, stop generation first
  if (threadId === activeThreadId.value && composerSending.value) await stopActiveGeneration()
  if (threadId !== activeThreadId.value && isConversationSending(threadId)) {
    puppetNodeAiStopApi({ sessionId: props.sessionId, threadId }).catch(() => {})
    busyThreadIds.value = busyThreadIds.value.filter(id => id !== threadId)
  }
  await deleteThread(threadId)
  // After deletion, activeThreadId may have changed — load new active thread's history
  if (activeThreadId.value && activeThreadId.value !== threadId) {
    await loadThreadHistory(activeThreadId.value)
  } else if (!activeThreadId.value) {
    setMessages([])
  }
}

const shouldRecoverThreadProgress = (threadId, { force = false } = {}) => {
  if (!threadId) return false
  if (force) return true
  const threadMeta = threads.value.find(t => t.threadId === threadId)
  const localStatus = threadId === activeThreadId.value
    ? activeConversationStatus.value?.status
    : conversationStatus.value?.[threadId]?.status
  const status = normalizeAiStatus(localStatus || threadMeta?.runStatus)
  return (
    ACTIVE_AI_STATUSES.includes(status) ||
    !!threadMeta?.executing
  )
}

const recoverThreadProgress = async (threadId, { force = false, allowDuringHistoryLoading = false } = {}) => {
  if (!threadId) return false
  if (historyLoading.value && !allowDuringHistoryLoading) return false
  if (!shouldRecoverThreadProgress(threadId, { force })) return false
  const sessionId = props.sessionId
  return resumeConversationStream({
    key: threadId,
    isCurrent: () => (
      sessionId === props.sessionId &&
      threadId === activeThreadId.value
    )
  })
}

const recoverActiveThreadProgress = async () => {
  await recoverThreadProgress(activeThreadId.value)
}

const syncThreadStatuses = async () => {
  if (!props.sessionId) return
  if (statusSyncPromise) return statusSyncPromise
  const sessionId = props.sessionId
  const request = (async () => {
    await refreshThreadStatuses()
    if (sessionId === props.sessionId) await recoverActiveThreadProgress()
  })
  statusSyncPromise = request
  try {
    return await request
  } finally {
    if (statusSyncPromise === request) statusSyncPromise = null
  }
}

// ── Hot-switch AI channel ─────────────────────────────────────────────────────
watch(selectedConfigId, async (newId, oldId) => {
  if (syncingConfigSelection.value) {
    syncingConfigSelection.value = false
    return
  }
  if (revertingConfigSelection.value) {
    revertingConfigSelection.value = false
    return
  }
  const userRequested = requestedModelSwitchId.value === newId
  requestedModelSwitchId.value = null
  if (!props.sessionId || !activeThreadId.value || newId === oldId || newId == null) return
  const sessionId = props.sessionId
  const threadId = activeThreadId.value
  const sequence = requestGuard.next('config')
  try {
    await puppetNodeAiSwitchChannelApi({
      sessionId,
      threadId,
      configId: newId
    })
    if (!requestGuard.isCurrent('config', sequence)) return
    if (sessionId !== props.sessionId || threadId !== activeThreadId.value) return
    if (userRequested) {
      const config = configs.value.find(item => item.id === newId)
      const modelName = config?.model || config?.name || `#${newId}`
      messages.value.push({ role: 'system-info', content: `模型已切换至 ${modelName}`, timestamp: Date.now() })
    }
  } catch (e) {
    if (!requestGuard.isCurrent('config', sequence)) return
    if (sessionId !== props.sessionId || threadId !== activeThreadId.value) return
    revertingConfigSelection.value = true
    selectedConfigId.value = oldId
    showError('切换 AI 通道失败：' + (e?.message || '未知错误'))
  }
})

// ── Scroll on new messages ────────────────────────────────────────────────────
watch(
  () => messages.value.length,
  () => { nextTick(() => scrollbarRef.value?.setScrollTop?.(999999)) }
)

// ── Session lifecycle ─────────────────────────────────────────────────────────
const initializeForSession = async (sessionId, previousSessionId) => {
  requestGuard.invalidate(['history', 'recon', 'config', 'init'])
  const sequence = requestGuard.next('init')
  const previousThreadId = activeThreadId.value
  statusSyncPromise = null

  if (previousSessionId && previousThreadId && composerSending.value) {
    await Promise.allSettled([
      stopGeneration(),
      puppetNodeAiStopApi({ sessionId: previousSessionId, threadId: previousThreadId })
    ])
  }
  if (!requestGuard.isCurrent('init', sequence) || sessionId !== props.sessionId) return

  if (previousThreadId) setMessages([], previousThreadId)
  threads.value = []
  activeThreadId.value = null
  historyLoading.value = false
  creatingThread.value = false
  sentHistory.value = []
  attachments.value = []
  draft.value = ''
  busyThreadIds.value = []
  sendingSessionsByThread.clear()
  reconSummaryExists.value = false
  if (!sessionId) return

  await fetchConfigs()
  if (!requestGuard.isCurrent('init', sequence) || sessionId !== props.sessionId) return
  await Promise.all([fetchReconSummaryStatus(sessionId), fetchThreads()])
  if (!requestGuard.isCurrent('init', sequence) || sessionId !== props.sessionId) return
  if (activeThreadId.value) {
    syncSelectedConfigFromThread(activeThreadId.value)
    await loadThreadHistory(activeThreadId.value)
  }
}

watch(
  () => props.sessionId,
  (sessionId, previousSessionId) => initializeForSession(sessionId, previousSessionId),
  { immediate: true }
)

// ── Recon summary event ───────────────────────────────────────────────────────
useAppEvent('recon-summary-updated', ({ sessionId, exists }) => {
  if (sessionId === props.sessionId) reconSummaryExists.value = !!exists
})

const onVisibilityChange = () => {
  if (!document.hidden) syncThreadStatuses()
}

const onNetworkOnline = () => {
  syncThreadStatuses()
}

onMounted(() => {
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('online', onNetworkOnline)
  threadStatusTimer = window.setInterval(() => {
    // 仅在存在活跃线程或待确认时才轮询
    const hasActiveWork = threads.value.some(t => {
      const s = normalizeAiStatus(t.runStatus || 'idle')
      return ACTIVE_AI_STATUSES.includes(s) || s === 'waiting_for_user' || !!t.executing
    })
    if (document.hidden) return          // 页面不可见时暂停
    if (!hasActiveWork && !busyThreadIds.value.length && !sending.value) return
    syncThreadStatuses()
  }, 5000)
})

onUnmounted(() => {
  requestGuard.invalidate()
  statusSyncPromise = null
  document.removeEventListener('visibilitychange', onVisibilityChange)
  window.removeEventListener('online', onNetworkOnline)
  if (threadStatusTimer !== null) {
    window.clearInterval(threadStatusTimer)
    threadStatusTimer = null
  }
  disconnectAllConversationStreams()
})

</script>

<style scoped>
.puppet-ai-assistant {
  --thread-max: min(76rem, 100%);
  --ai-panel-surface: var(--ai-dock-background, var(--app-surface-background));
  --ai-muted-surface: var(--ai-panel-surface);
  --surface-border: color-mix(in srgb, var(--el-border-color) 20%, transparent);
  --composer-shadow: 0 0 0 1px color-mix(in srgb, var(--el-border-color) 42%, transparent);
  --accent-soft: var(--el-color-primary);

  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  position: relative;
  border-radius: 8px;
  border: 0;
  background: var(--ai-panel-surface);
  gap: 0;
  padding: 0;
  box-shadow: none;
}

.assistant-header {
  min-height: 58px;
  padding: 0 12px 0 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-shrink: 0;
  background: color-mix(in srgb, var(--ai-muted-surface) 96%, transparent);
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
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 10px;
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 9%, transparent);
  font-size: 17px;
}

.assistant-heading {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.assistant-heading strong {
  color: var(--el-text-color-primary);
  font-size: 14px;
  line-height: 1.25;
}

.assistant-heading span {
  color: var(--el-text-color-secondary);
  font-size: 10.5px;
  white-space: nowrap;
}

.assistant-model {
  max-width: 150px;
  overflow: hidden;
  padding: 4px 8px;
  border-radius: 10px;
  color: var(--el-text-color-secondary);
  background: color-mix(in srgb, var(--el-text-color-primary) 4%, transparent);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.assistant-actions {
  flex-shrink: 0;
  gap: 5px;
}

.header-action {
  width: 30px;
  height: 30px;
  justify-content: center;
  border: 0;
  border-radius: 9px;
  color: var(--el-text-color-secondary);
  background: transparent;
  cursor: pointer;
}

.header-action:hover:not(:disabled) {
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 7%, transparent);
}

.header-action.is-primary {
  color: #fff;
  background: var(--el-color-primary);
}

.header-action:disabled {
  opacity: .4;
  cursor: not-allowed;
}

:global(html:not(.dark) .puppet-ai-assistant),
:global(html[data-theme='light'] .puppet-ai-assistant) {
  --ai-muted-surface: #ffffff;
}

/* ── Chat area ───────────────────────────────────────────────────────────────── */

.chat-area {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  position: relative;
  border-radius: 0;
  background: transparent;
}

.chat-area::before {
  display: none;
}

.channel-opt-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.channel-opt-model {
  float: right;
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: var(--el-text-color-secondary);
}

.chat-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  position: relative;
}

.messages-scroll {
  flex: 1;
  min-height: 0;
}

.messages-scroll :deep(.el-scrollbar__wrap) {
  overscroll-behavior: contain;
}

.messages-scroll :deep(.el-scrollbar__bar.is-vertical) {
  width: 8px;
}

.messages-scroll :deep(.el-scrollbar__thumb) {
  background: color-mix(in srgb, var(--el-text-color-primary) 16%, transparent);
}

.thread {
  min-height: 100%;
  max-width: var(--thread-max);
  margin: 0 auto;
  width: 100%;
  padding: 8px 0 18px;
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
  background: #fffbe6;
  border: 0;
  color: #7c5b00;
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
</style>
