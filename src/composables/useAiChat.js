import { computed, nextTick, ref } from 'vue'
import { ACTIVE_AI_STATUSES, TERMINAL_AI_STATUSES, normalizeAiStatus } from '@/utils/aiRuntime.js'
import { showError } from '@/utils/messageUtils.js'
import { createAiChatEventReducer } from './aiChatEventReducer.js'
import { transitionStatus } from './aiChatStateMachine.js'
import { createAssistantMessage, createUserMessage } from './aiMessageFactory.js'
import { createLogger } from '@/utils/logger.js'

const logger = createLogger('AiChat')

function createClientUserMessageId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  return `client-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

/** 写入 assistant 消息的终态 runtime + loading + completedAt。 */
function finalizeAssistantMessage(msg, { status, phase }) {
  if (!msg) return
  msg.loading = false
  msg.completedAt = Date.now()
  msg.runtime = {
    ...(msg.runtime || {}),
    phase: phase || status,
    status,
    updatedAt: Date.now()
  }
}

/**
 * 通用 AI 对话 composable，供 PlatformAiAssistant 和 PuppetAiAssistant 共用。
 *
 * @param {object} opts
 * @param {Function} [opts.enqueueApi]
 *   持久化 Turn 并返回权威快照
 * @param {Function} [opts.stopApi]
 *   async({ ...extra }) → void
 *   调用后端中断接口，彻底停止 Agent 线程（不仅断开 SSE）
 * @param {Function} [opts.onComplete]
 *   () → void，每次 send 完成（成功或失败）后回调，用于更新线程元数据等
 * @param {Function} opts.canSend          - () → boolean，Agent 就绪 / Session 有效时返回 true
 * @param {Function} [opts.getExtraParams] - () → object，附加参数（如 sessionId、threadId）
 * @param {string}   [opts.errorLabel]     - 错误提示前缀
 */
export function useAiChat({
  enqueueApi,
  stopApi,
  recoverEventsApi,
  subscribeApi,
  onComplete,
  canSend,
  getExtraParams = () => ({}),
  getConversationKey = () => 'default',
  errorLabel = 'AI 对话请求失败'
}) {
  // ── 基础状态 ───────────────────────────────────────────────────────────────
  const scrollbarRef      = ref(null)

  const states = ref({})

  const normalizeKey = (key) => {
    const value = typeof key === 'function' ? key() : key
    return String(value || 'default')
  }

  const activeKey = computed(() => normalizeKey(getConversationKey))

  function createState() {
    return {
      messages: [],
      draft: '',
      sending: false,
      composerComposing: false,
      subscriptionAbort: null,
      subscriptionPromise: null,
      stopPromise: null,
      activeTurnId: null,
      activeItemId: null,
      activeClientUserMessageId: null,
      interrupting: false,
      interruptRequestSent: false,
      queuedTurnIds: [],
      pendingUserInput: null,
      answeringQuestionId: null,
      status: 'idle',
      lastEventSeq: 0,
      lastHeartbeatAt: null,
      heartbeat: null,
      recovering: false,
    }
  }

  function ensureState(key = activeKey.value) {
    const normalized = normalizeKey(key)
    if (!states.value[normalized]) {
      states.value[normalized] = createState()
    }
    return states.value[normalized]
  }

  const activeState = computed(() => ensureState(activeKey.value))

  const messages = computed({
    get: () => activeState.value.messages,
    set: (value) => { activeState.value.messages = Array.isArray(value) ? value : [] }
  })
  const draft = computed({
    get: () => activeState.value.draft,
    set: (value) => { activeState.value.draft = value }
  })
  const sending = computed({
    get: () => !!activeState.value.sending,
    set: (value) => { activeState.value.sending = !!value }
  })
  const composerComposing = computed({
    get: () => !!activeState.value.composerComposing,
    set: (value) => { activeState.value.composerComposing = !!value }
  })

  // ── Scroll ─────────────────────────────────────────────────────────────────
  const scrollToBottom = () => {
    nextTick(() => {
      scrollbarRef.value?.setScrollTop?.(999999)
    })
  }

  // ── 中止 ───────────────────────────────────────────────────────────────────
  /**
   * 停止当前生成。
   * 向后端请求 interrupt，并继续保持事件订阅，直到收到 turn/completed。
   * 这保证停止前的增量内容和 interrupted 终态都能进入同一条消息。
   */
  const stopGeneration = () => {
    const key = activeKey.value
    const state = ensureState(key)
    const status = normalizeAiStatus(state.status)
    // stop 是显式用户命令；即使刚刷新、尚未完成本地快照恢复，也交给后端解析
    // 当前 active Turn，不能依赖内存里的 activeTurnId 决定是否发送。
    const shouldStopRemote = !!stopApi ||
      state.sending || ACTIVE_AI_STATUSES.includes(status)
    let stopPromise = Promise.resolve(false)
    if (stopApi && shouldStopRemote) {
      state.interrupting = true
      state.interruptRequestSent = true
      transitionStatus(state, 'cancelling', 'interrupt-requested')
      stopPromise = stopApi({
        ...getExtraParams(key),
        ...(state.activeTurnId ? { turnId: state.activeTurnId } : {})
      })
        .then((response) => {
          const turn = response?.data?.turn
          if (turn?.id && normalizeAiStatus(turn.status) === 'cancelled') {
            state.queuedTurnIds = state.queuedTurnIds
              .filter(id => String(id) !== String(turn.id))
            if (!state.activeTurnId && state.queuedTurnIds.length === 0) {
              transitionStatus(state, 'cancelled', 'interrupt-confirmed')
              state.sending = false
            }
          }
          return turn || true
        })
        .catch((error) => {
          state.interrupting = false
          state.interruptRequestSent = false
          logger.error(`Turn 中断请求失败 key=${key}: ${error?.message || error}`, error)
          return false
        })
        .finally(() => {
          if (state.stopPromise === stopPromise) state.stopPromise = null
        })
      state.stopPromise = stopPromise
      return stopPromise
    }

    if (shouldStopRemote) transitionStatus(state, 'cancelled', 'local-stop')
    state.sending = false
    state.subscriptionAbort?.abort()
    return stopPromise
  }

  const aiEventReducer = createAiChatEventReducer({
    ensureState,
    getActiveKey: () => activeKey.value,
    onVisibleEvent: (key) => {
      if (key === activeKey.value) scrollToBottom()
    }
  })

  const { makeRecoveryHandlers } = aiEventReducer

  const applyRecoveredEvents = (params = {}) => {
    const key = params.key ?? activeKey.value
    const result = aiEventReducer.applyRecoveredEvents({ ...params, key })
    if (key === activeKey.value) scrollToBottom()
    return result
  }

  const isTerminalStatus = (status) => TERMINAL_AI_STATUSES.includes(normalizeAiStatus(status))
  const isStreamSettledStatus = (status) => {
    const normalized = normalizeAiStatus(status)
    return isTerminalStatus(normalized) || normalized === 'waiting_for_user'
  }

  const hydrateConversationRuntime = (snapshot = {}, key = activeKey.value) => {
    const state = ensureState(normalizeKey(key))
    const activeTurn = snapshot?.activeTurn || null
    const queuedTurns = Array.isArray(snapshot?.queuedTurns)
      ? snapshot.queuedTurns
      : []
    state.queuedTurnIds = queuedTurns
      .map(turn => turn?.id)
      .filter(Boolean)
      .map(String)
    state.pendingUserInput = snapshot?.pendingUserInput || null
    const pendingQuestionId = String(state.pendingUserInput?.questionId || '')
    for (const message of state.messages) {
      for (const node of (message?.nodes || [])) {
        if (node?.kind !== 'user_input') continue
        node.status = pendingQuestionId && String(node.questionId) === pendingQuestionId
          ? 'pending'
          : 'answered'
      }
    }

    if (activeTurn?.id) {
      const items = Array.isArray(activeTurn.items) ? activeTurn.items : []
      const assistantItem = items.find(item => item?.role === 'assistant')
      state.activeTurnId = String(activeTurn.id)
      state.activeItemId = assistantItem?.id ? String(assistantItem.id) : null
      state.activeClientUserMessageId = activeTurn.clientUserMessageId || null
    } else {
      state.activeTurnId = null
      state.activeItemId = null
      state.activeClientUserMessageId = null
    }

    const status = normalizeAiStatus(
      snapshot?.runStatus || snapshot?.status || state.status
    )
    const hasEventBacklog =
      Number(snapshot?.lastSeq || 0) > Number(state.lastEventSeq || 0)
    const hasInProgressTurns = !!activeTurn || queuedTurns.length > 0 ||
      !!snapshot?.executing
    if (hasInProgressTurns || !hasEventBacklog) {
      transitionStatus(state, status, 'thread-snapshot')
      state.sending = snapshot?.executing != null
        ? !!snapshot.executing
        : ACTIVE_AI_STATUSES.includes(status)
    }

    const turns = [...(activeTurn ? [activeTurn] : []), ...queuedTurns]
    for (const turn of turns) {
      const items = Array.isArray(turn?.items) ? turn.items : []
      const assistantItem = items.find(item => item?.role === 'assistant')
      const message = state.messages.find(item =>
        item?.role === 'assistant' && (
          String(item.turnId || '') === String(turn.id) ||
          (assistantItem?.id && String(item.id || '') === String(assistantItem.id))
        ))
      if (!message) continue
      if (assistantItem?.id) message.id = String(assistantItem.id)
      message.turnId = String(turn.id)
      message.loading = true
      message.runtime = {
        ...(message.runtime || {}),
        turnId: String(turn.id),
        phase: turn.status || 'queued',
        status: normalizeAiStatus(turn.status),
        updatedAt: Date.now()
      }
    }
    return state
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  /**
   * 从当前游标开始连续补拉事件，直到追平服务端 lastSeq。
   *
   * 单次 events API 有条数上限；页面刷新或长时间断线后可能积压多页事件，
   * 因此恢复必须逐页推进，不能把服务端 lastSeq 当成本页游标。
   */
  const pullRecoveredEventBacklog = async ({
    key,
    limit = 200,
    maxPages = 20,
    isCurrent = () => true
  }) => {
    const state = ensureState(key)
    let pageCount = 0
    let receivedEventCount = 0
    let snapshot = null

    while (pageCount < maxPages && isCurrent()) {
      const afterSeq = Number(state.lastEventSeq || 0)
      snapshot = await recoverEventsApi({
        afterSeq,
        limit,
        ...getExtraParams(key)
      })
      if (!isCurrent()) return { stale: true, pageCount, receivedEventCount, snapshot }

      hydrateConversationRuntime(snapshot, key)
      const events = Array.isArray(snapshot?.events) ? snapshot.events : []
      const replay = applyRecoveredEvents({
        key,
        events,
        runStatus: snapshot?.runStatus,
        lastSeq: snapshot?.lastSeq,
        taskTimeoutAt: snapshot?.taskTimeoutAt,
        stopReason: snapshot?.stopReason
      })
      pageCount += 1
      receivedEventCount += events.length

      const cursor = Number(replay?.cursor || state.lastEventSeq || 0)
      const serverLastSeq = Number(replay?.serverLastSeq || snapshot?.lastSeq || 0)
      if (cursor >= serverLastSeq || cursor <= afterSeq) {
        return {
          stale: false,
          caughtUp: cursor >= serverLastSeq,
          pageCount,
          receivedEventCount,
          snapshot
        }
      }
    }

    return {
      stale: !isCurrent(),
      caughtUp: false,
      pageCount,
      receivedEventCount,
      snapshot
    }
  }

  /**
   * 页面刷新、重新显示或网络恢复后，对指定会话执行一次完整事件追平。
   */
  const recoverConversation = async ({
    key = activeKey.value,
    limit = 200,
    maxPages = 20,
    isCurrent = () => true
  } = {}) => {
    if (!recoverEventsApi) return { caughtUp: true, pageCount: 0, receivedEventCount: 0 }
    const normalizedKey = normalizeKey(key)
    const state = ensureState(normalizedKey)
    state.recovering = true
    try {
      return await pullRecoveredEventBacklog({
        key: normalizedKey,
        limit,
        maxPages,
        isCurrent
      })
    } finally {
      state.recovering = false
    }
  }

  /**
   * 重新附着运行中会话的实时流。连接断开后从 lastEventSeq 自动续接；
   * 本地视图断开只释放订阅，不影响后台任务。
   */
  const resumeConversationStream = ({
    key = activeKey.value,
    isCurrent = () => true
  } = {}) => {
    if (!subscribeApi) return false
    const normalizedKey = normalizeKey(key)
    const state = ensureState(normalizedKey)
    if (state.subscriptionPromise) return true

    const controller = new AbortController()
    state.subscriptionAbort = controller
    state.sending = true

    const follow = async () => {
      let delay = 500
      try {
        if (recoverEventsApi) {
          try {
            await recoverConversation({ key: normalizedKey, isCurrent })
          } catch (error) {
            logger.warn(`线程快照恢复失败 key=${normalizedKey}: ${error?.message || error}`)
          }
        }
        while (!controller.signal.aborted && isCurrent()) {
          try {
            await subscribeApi({
              signal: controller.signal,
              afterSeq: Number(state.lastEventSeq || 0),
              ...makeRecoveryHandlers(normalizedKey),
              ...getExtraParams(normalizedKey)
            })
            if (isStreamSettledStatus(state.status)) break
          } catch (error) {
            if (controller.signal.aborted || error?.name === 'AbortError') break
            if (isStreamSettledStatus(state.status)) break
            logger.warn(`实时流续接失败 key=${normalizedKey}: ${error?.message || error}`)
          }
          await sleep(delay)
          delay = Math.min(Math.floor(delay * 1.6), 5000)
        }
      } finally {
        if (state.subscriptionAbort === controller) {
          state.subscriptionAbort = null
          state.subscriptionPromise = null
          state.sending = ACTIVE_AI_STATUSES.includes(normalizeAiStatus(state.status))
          if (isStreamSettledStatus(state.status)) {
            state.sending = false
            onComplete?.({ key: normalizedKey })
          }
        }
      }
    }

    // 延后一拍启动，确保极短生命周期下 finally 不会先于 promise 引用赋值。
    state.subscriptionPromise = Promise.resolve().then(follow)
    return true
  }

  /** 仅断开本地实时视图，不调用后端 stop。 */
  const disconnectConversationStream = (key = activeKey.value) => {
    const state = ensureState(normalizeKey(key))
    state.subscriptionAbort?.abort()
  }

  const disconnectAllConversationStreams = () => {
    for (const state of Object.values(states.value)) {
      state.subscriptionAbort?.abort()
    }
  }

  // ── 快捷提示词 ──────────────────────────────────────────────────────────────
  const applyPrompt = (value) => {
    ensureState().draft = value
  }

  /**
   * 提交命令只负责持久化 Turn。执行顺序、取消与后续唤醒全部由后端数据库队列决定；
   * 前端只追加乐观消息并维持一个线程级事件订阅。
   */
  const send = (options = {}) => {
    const key = activeKey.value
    const state = ensureState(key)
    const pendingInput = state.pendingUserInput
    const answerToQuestionId = String(
      options.answerToQuestionId || options.requestParams?.answerToQuestionId || ''
    ).trim() || null
    if (pendingInput && !answerToQuestionId) return Promise.resolve(null)
    const isQuestionAnswer = Boolean(answerToQuestionId)
    const text = String(options.text ?? state.draft).trim()
    if (!text || !canSend(key)) return Promise.resolve()
    if (!enqueueApi) {
      return Promise.reject(new Error('未配置 Turn 提交接口'))
    }

    let userMessageIdx = null
    if (!isQuestionAnswer) {
      state.messages.push(createUserMessage({
        content: text,
        displayText: options.displayText,
        attachments: options.attachments
      }))
      userMessageIdx = state.messages.length - 1
    }
    state.draft = ''
    const assistantIdx = state.messages.length
    state.messages.push(createAssistantMessage({
      answerToQuestionId,
      runtime: { phase: 'queued', status: 'queued' }
    }))
    const clientUserMessageId =
      options.clientUserMessageId || createClientUserMessageId()
    const assistant = state.messages[assistantIdx]
    if (assistant?.role === 'assistant') {
      assistant.retryClientUserMessageId = clientUserMessageId
    }
    state.sending = true
    if (!ACTIVE_AI_STATUSES.includes(normalizeAiStatus(state.status))) {
      transitionStatus(state, 'queued', 'turn-submitted')
    }
    scrollToBottom()

    const operation = (async () => {
      try {
        if (answerToQuestionId && pendingInput
            && String(pendingInput.questionId) !== answerToQuestionId) {
          throw new Error('该问题已更新，请回答最新问题')
        }
        if (answerToQuestionId) {
          state.answeringQuestionId = answerToQuestionId
          for (const message of state.messages) {
            for (const node of (message?.nodes || [])) {
              if (node?.kind === 'user_input' && String(node.questionId) === String(answerToQuestionId)) {
                node.status = 'answering'
                node.updatedAt = Date.now()
              }
            }
          }
        }
        const turn = await enqueueApi({
          message: text,
          clientUserMessageId,
          ...getExtraParams(key),
          ...(options.requestParams || {}),
          ...(answerToQuestionId ? { answerToQuestionId } : {})
        })
        const assistant = state.messages[assistantIdx]
        if (answerToQuestionId) {
          for (const message of state.messages) {
            for (const node of (message?.nodes || [])) {
              if (node?.kind === 'user_input' && String(node.questionId) === String(answerToQuestionId)) {
                node.status = 'answered'
                node.answer = text
                node.updatedAt = Date.now()
              }
            }
          }
          state.pendingUserInput = null
        }
        const items = Array.isArray(turn?.items) ? turn.items : []
        const userItem = items.find(item => item?.role === 'user')
        const assistantItem = items.find(item => item?.role === 'assistant')
        if (assistant?.role === 'assistant') {
          if (assistantItem?.id) assistant.id = String(assistantItem.id)
          assistant.turnId = turn?.id || null
          assistant.runtime = {
            ...(assistant.runtime || {}),
            turnId: turn?.id || null,
            phase: turn?.status || 'queued',
            status: normalizeAiStatus(turn?.status || 'queued'),
            updatedAt: Date.now()
          }
        }
        const user = userMessageIdx != null ? state.messages[userMessageIdx] : null
        if (user?.role === 'user') {
          if (userItem?.id) user.id = String(userItem.id)
          user.turnId = turn?.id || null
        }
        if (turn?.id && normalizeAiStatus(turn.status) === 'queued') {
          state.queuedTurnIds = [
            ...state.queuedTurnIds.filter(id => String(id) !== String(turn.id)),
            String(turn.id)
          ]
        }
        resumeConversationStream({ key })
        return turn
      } catch (error) {
        if (answerToQuestionId && pendingInput) {
          state.pendingUserInput = pendingInput
          for (const message of state.messages) {
            for (const node of (message?.nodes || [])) {
              if (node?.kind === 'user_input' && String(node.questionId) === String(answerToQuestionId)) {
                node.status = 'pending'
                node.answer = null
              }
            }
          }
        }
        const assistant = state.messages[assistantIdx]
        if (assistant?.role === 'assistant') {
          assistant.content = `调用失败：${error?.message || '指令提交失败'}`
          assistant.failed = true
          assistant.retryText = text
          finalizeAssistantMessage(assistant, { status: 'failed' })
        }
        state.sending = !!state.activeTurnId || state.queuedTurnIds.length > 0
        state.answeringQuestionId = null
        if (!state.sending) transitionStatus(state, 'failed', 'turn-submit-failed')
        showError(errorLabel)
        return null
      } finally {
        if (answerToQuestionId && state.answeringQuestionId === answerToQuestionId) {
          state.answeringQuestionId = null
        }
      }
    })()
    return operation
  }

  // ── 重试 ────────────────────────────────────────────────────────────────────
  const retry = (msg) => {
    const key = activeKey.value
    const state = ensureState(key)
    if (!msg?.retryText || state.sending || !canSend(key)) return
    send({
      text: msg.retryText,
      ...(msg.retryClientUserMessageId
        ? { clientUserMessageId: msg.retryClientUserMessageId }
        : {}),
      ...(msg.answerToQuestionId ? { answerToQuestionId: msg.answerToQuestionId } : {})
    })
  }

  const answerUserInput = ({ questionId, answer } = {}) => {
    const state = ensureState(activeKey.value)
    const expected = String(state.pendingUserInput?.questionId || '')
    const id = String(questionId || '')
    const text = String(answer || '').trim()
    if (!id || !text || !expected || id !== expected || state.answeringQuestionId) {
      return Promise.resolve(null)
    }
    return send({
      text,
      answerToQuestionId: id
    })
  }

  // ── 会话管理 ────────────────────────────────────────────────────────────────
  /** 直接替换消息列表（用于加载线程历史记录）。 */
  const setMessages = (msgs, key = activeKey.value) => {
    const state = ensureState(key)
    state.messages = Array.isArray(msgs) ? msgs : []
    state.lastEventSeq = 0
  }

  const hasLocalMessages = (key = activeKey.value) => {
    return ensureState(key).messages.length > 0
  }

  const isConversationSending = (key = activeKey.value) => {
    return !!ensureState(key).sending
  }

  const conversationStatus = computed(() => {
    const map = {}
    for (const [key, state] of Object.entries(states.value)) {
      map[key] = {
        status: state.status || (state.sending ? 'running' : 'idle'),
        sending: !!state.sending,
        recovering: !!state.recovering,
        lastEventSeq: Number(state.lastEventSeq || 0),
        lastHeartbeatAt: state.lastHeartbeatAt,
        heartbeat: state.heartbeat,
        taskTimeoutAt: state.heartbeat?.taskTimeoutAt || null,
        stopReason: state.heartbeat?.stopReason || null,
        failed: state.status === 'failed',
        stopped: state.status === 'cancelled',
        pendingUserInput: state.pendingUserInput,
        answeringQuestionId: state.answeringQuestionId
      }
    }
    return map
  })

  return {
    messages,
    draft,
    sending,
    composerComposing,
    scrollbarRef,
    conversationStatus,
    send,
    answerUserInput,
    stopGeneration,
    setMessages,
    hasLocalMessages,
    isConversationSending,
    applyRecoveredEvents,
    recoverConversation,
    resumeConversationStream,
    disconnectConversationStream,
    disconnectAllConversationStreams,
    applyPrompt,
    retry,
  }
}
