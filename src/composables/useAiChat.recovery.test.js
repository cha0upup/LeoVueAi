import { describe, expect, it, vi } from 'vitest'
import { useAiChat } from './useAiChat.js'

describe('useAiChat refresh recovery', () => {
  it('submits a structured answer without rendering it as a user command', async () => {
    const enqueueApi = vi.fn(async () => ({
      id: 'turn-answer',
      status: 'queued',
      answerToQuestionId: 'question-1',
      items: [{ id: 'user-answer', role: 'user' }, { id: 'assistant-answer', role: 'assistant' }]
    }))
    const chat = useAiChat({
      enqueueApi,
      canSend: () => true,
      getConversationKey: () => 'thread-question',
      getExtraParams: threadId => ({ threadId })
    })
    chat.applyRecoveredEvents({
      key: 'thread-question',
      events: [{
        seq: 1,
        name: 'node',
        turnId: 'turn-question',
        itemId: 'assistant-question',
        data: {
          kind: 'user_input',
          questionId: 'question-1',
          type: 'CLARIFICATION',
          prompt: '请选择范围',
          status: 'pending'
        }
      }],
      lastSeq: 1,
      runStatus: 'waiting_for_user'
    })

    await chat.answerUserInput({ questionId: 'question-1', answer: '当前节点' })

    expect(enqueueApi).toHaveBeenCalledWith(expect.objectContaining({
      message: '当前节点',
      answerToQuestionId: 'question-1'
    }))
    expect(chat.messages.value.filter(message => message.role === 'user')).toHaveLength(0)
    expect(chat.messages.value.at(-1)).toMatchObject({
      role: 'assistant',
      answerToQuestionId: 'question-1'
    })
    expect(chat.conversationStatus.value['thread-question'].pendingUserInput).toBeNull()
  })

  it('retries a failed answer with the original question id and idempotency key', async () => {
    const enqueueApi = vi.fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({
        id: 'turn-answer',
        status: 'queued',
        items: [{ id: 'user-answer', role: 'user' }, { id: 'assistant-answer', role: 'assistant' }]
      })
    const chat = useAiChat({
      enqueueApi,
      canSend: () => true,
      getConversationKey: () => 'thread-question',
      getExtraParams: threadId => ({ threadId })
    })
    chat.applyRecoveredEvents({
      key: 'thread-question',
      events: [{
        seq: 1,
        name: 'node',
        turnId: 'turn-question',
        itemId: 'assistant-question',
        data: {
          kind: 'user_input',
          questionId: 'question-1',
          type: 'CLARIFICATION',
          prompt: '请选择范围',
          status: 'pending'
        }
      }],
      lastSeq: 1,
      runStatus: 'waiting_for_user'
    })

    await chat.answerUserInput({ questionId: 'question-1', answer: '当前节点' })
    const failed = chat.messages.value.at(-1)
    expect(failed).toMatchObject({
      failed: true,
      answerToQuestionId: 'question-1'
    })
    const firstRequest = enqueueApi.mock.calls[0][0]

    chat.retry(failed)
    await vi.waitFor(() => expect(enqueueApi).toHaveBeenCalledTimes(2))

    expect(enqueueApi.mock.calls[1][0]).toEqual(expect.objectContaining({
      answerToQuestionId: 'question-1',
      clientUserMessageId: firstRequest.clientUserMessageId
    }))
  })

  it('replays every event page before applying the terminal status', async () => {
    const calls = []
    let chat
    const recoverEventsApi = vi.fn(async ({ afterSeq }) => {
      calls.push(afterSeq)
      if (afterSeq === 0) {
        return {
          events: [
            { seq: 1, name: 'status', data: 'running' },
            { seq: 2, name: 'delta', data: 'hel' }
          ],
          lastSeq: 4,
          runStatus: 'completed'
        }
      }
      expect(chat.conversationStatus.value['thread-1']?.status).toBe('running')
      return {
        events: [
          { seq: 3, name: 'delta', data: 'lo' },
          { seq: 4, name: 'turn', data: { content: 'hello' } }
        ],
        lastSeq: 4,
        runStatus: 'completed'
      }
    })

    chat = useAiChat({
      recoverEventsApi,
      canSend: () => true,
      getConversationKey: () => 'thread-1',
      getExtraParams: () => ({ threadId: 'thread-1' })
    })

    const result = await chat.recoverConversation({ key: 'thread-1', limit: 2 })

    expect(calls).toEqual([0, 2])
    expect(result).toMatchObject({ caughtUp: true, pageCount: 2, receivedEventCount: 4 })
    expect(chat.messages.value).toHaveLength(1)
    expect(chat.messages.value[0]).toMatchObject({
      role: 'assistant',
      content: 'hello',
      loading: false
    })
    expect(chat.conversationStatus.value['thread-1']).toMatchObject({
      status: 'completed',
      lastEventSeq: 4
    })
  })

  it('reattaches a live stream from the current cursor and applies new events', async () => {
    const subscribeApi = vi.fn(async (params) => {
      expect(params.threadId).toBe('thread-live')
      expect(params.afterSeq).toBe(7)
      params.onTurnStarted({
        turn: {
          id: 'turn-live',
          status: 'inProgress',
          items: [{ id: 'item-live', role: 'assistant' }]
        }
      }, 8)
      params.onStatus('running', 9)
      params.onDelta('live ', 10)
      params.onTurn({ content: 'live answer' }, 11)
      params.onTurnCompleted({
        turn: { id: 'turn-live', status: 'completed' }
      }, 12)
      return 'live answer'
    })
    const onComplete = vi.fn()
    const chat = useAiChat({
      subscribeApi,
      onComplete,
      canSend: () => true,
      getConversationKey: () => 'thread-live',
      getExtraParams: (threadId) => ({ threadId })
    })
    chat.applyRecoveredEvents({
      key: 'thread-live',
      events: [{ seq: 7, name: 'status', data: 'running' }],
      lastSeq: 7,
      runStatus: 'running'
    })

    expect(chat.resumeConversationStream({ key: 'thread-live' })).toBe(true)

    await vi.waitFor(() => {
      expect(chat.conversationStatus.value['thread-live']).toMatchObject({
        status: 'completed',
        sending: false,
        lastEventSeq: 12
      })
    })
    expect(chat.messages.value.at(-1)).toMatchObject({
      role: 'assistant',
      content: 'live answer',
      loading: false
    })
    expect(subscribeApi).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith({ key: 'thread-live' })
  })

  it('submits the next command immediately while the previous turn is cancelling', async () => {
    let resolveStop
    let resolveSubscription
    let streamHandlers
    const stopGate = new Promise(resolve => { resolveStop = resolve })
    const turns = [
      {
        id: 'turn-1',
        status: 'queued',
        items: [{ id: 'user-1', role: 'user' }, { id: 'assistant-1', role: 'assistant' }]
      },
      {
        id: 'turn-2',
        status: 'queued',
        items: [{ id: 'user-2', role: 'user' }, { id: 'assistant-2', role: 'assistant' }]
      }
    ]
    const enqueueApi = vi.fn(async () => turns.shift())
    const subscribeApi = vi.fn(async (params) => {
      streamHandlers = params
      return new Promise(resolve => { resolveSubscription = resolve })
    })
    const chat = useAiChat({
      enqueueApi,
      subscribeApi,
      stopApi: vi.fn(() => stopGate),
      canSend: () => true,
      getConversationKey: () => 'thread-stop',
      getExtraParams: threadId => ({ threadId })
    })

    await chat.send({ text: '第一条指令' })
    await vi.waitFor(() => expect(subscribeApi).toHaveBeenCalledTimes(1))
    streamHandlers.onTurnStarted({
      turn: {
        id: 'turn-1',
        status: 'running',
        items: [{ id: 'assistant-1', role: 'assistant' }]
      }
    }, 1)
    streamHandlers.onDelta('停止前已经生成的内容', 2, {
      turnId: 'turn-1',
      itemId: 'assistant-1'
    })

    const stopping = chat.stopGeneration()
    await chat.send({ text: '第二条指令' })
    expect(enqueueApi).toHaveBeenCalledTimes(2)
    expect(chat.messages.value[3]).toMatchObject({
      role: 'assistant',
      turnId: 'turn-2',
      loading: true,
      runtime: { status: 'queued' }
    })

    resolveStop(true)
    streamHandlers.onTurnCompleted({
      turn: { id: 'turn-1', status: 'interrupted', interruptRequested: true }
    }, 3)
    expect(chat.conversationStatus.value['thread-stop']).toMatchObject({
      status: 'queued',
      sending: true
    })
    streamHandlers.onTurnStarted({
      turn: {
        id: 'turn-2',
        status: 'running',
        items: [{ id: 'assistant-2', role: 'assistant' }]
      }
    }, 4)
    streamHandlers.onTurn({ content: '第二条指令已执行' }, 5, {
      turnId: 'turn-2',
      itemId: 'assistant-2'
    })
    streamHandlers.onTurnCompleted({
      turn: { id: 'turn-2', status: 'completed' }
    }, 6)
    resolveSubscription('')
    await stopping

    expect(chat.messages.value).toHaveLength(4)
    expect(chat.messages.value[1]).toMatchObject({
      role: 'assistant',
      turnId: 'turn-1',
      loading: false
    })
    expect(chat.messages.value[3]).toMatchObject({
      role: 'assistant',
      content: '第二条指令已执行',
      loading: false
    })
  })

  it('routes recovered events by stable itemId instead of the latest array position', () => {
    const chat = useAiChat({
      canSend: () => true,
      getConversationKey: () => 'thread-items'
    })
    chat.setMessages([
      {
        id: 'item-1',
        turnId: 'turn-1',
        role: 'assistant',
        content: '',
        nodes: [],
        loading: true,
        runtime: { turnId: 'turn-1', status: 'running' }
      },
      {
        id: 'item-2',
        turnId: 'turn-2',
        role: 'assistant',
        content: '',
        nodes: [],
        loading: true,
        runtime: { turnId: 'turn-2', status: 'running' }
      }
    ], 'thread-items')

    chat.applyRecoveredEvents({
      key: 'thread-items',
      events: [{
        seq: 1,
        name: 'delta',
        data: '旧 Turn 增量',
        turnId: 'turn-1',
        itemId: 'item-1'
      }],
      lastSeq: 1,
      runStatus: 'running'
    })

    expect(chat.messages.value[0].nodes[0].content).toBe('旧 Turn 增量')
    expect(chat.messages.value[1].nodes).toEqual([])
  })

  it('restores authoritative active and queued turns after a page refresh', async () => {
    const stopApi = vi.fn(async ({ turnId }) => {
      expect(turnId).toBe('turn-a')
      return {
        data: {
          turn: { id: 'turn-a', status: 'cancelling' }
        }
      }
    })
    const recoverEventsApi = vi.fn(async () => ({
      events: [],
      lastSeq: 18,
      runStatus: 'cancelling',
      status: 'cancelling',
      executing: true,
      activeTurn: {
        id: 'turn-a',
        status: 'cancelling',
        items: [{ id: 'assistant-a', role: 'assistant' }]
      },
      queuedTurns: [{
        id: 'turn-b',
        status: 'queued',
        items: [{ id: 'assistant-b', role: 'assistant' }]
      }]
    }))
    const chat = useAiChat({
      enqueueApi: vi.fn(),
      stopApi,
      recoverEventsApi,
      canSend: () => true,
      getConversationKey: () => 'thread-refresh',
      getExtraParams: threadId => ({ threadId })
    })
    chat.setMessages([
      {
        id: 'assistant-a',
        turnId: 'turn-a',
        role: 'assistant',
        content: '部分输出',
        nodes: [],
        loading: true,
        runtime: { status: 'running' }
      },
      {
        id: 'assistant-b',
        turnId: 'turn-b',
        role: 'assistant',
        content: '',
        nodes: [],
        loading: true,
        runtime: { status: 'queued' }
      }
    ], 'thread-refresh')

    await chat.recoverConversation({ key: 'thread-refresh' })
    await chat.stopGeneration()

    expect(stopApi).toHaveBeenCalledWith({
      threadId: 'thread-refresh',
      turnId: 'turn-a'
    })
    expect(chat.conversationStatus.value['thread-refresh']).toMatchObject({
      status: 'cancelling',
      sending: true,
      lastEventSeq: 0
    })
    expect(chat.messages.value[1].runtime).toMatchObject({
      turnId: 'turn-b',
      status: 'queued'
    })
  })
})
