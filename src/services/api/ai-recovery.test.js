import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAiChat } from '@/composables/useAiChat.js'

const { post } = vi.hoisted(() => ({ post: vi.fn() }))
vi.mock('../http.js', () => ({ default: { post } }))

import { platformAiEventsApi } from './platform-ai.js'
import { puppetNodeAiThreadEventsApi } from './puppet-ai.js'

describe.each([
  ['platform', platformAiEventsApi, '/platform/ai/events', {}],
  ['puppet', puppetNodeAiThreadEventsApi, '/puppet-node/ai/thread/events', { sessionId: 'session-1' }]
])('%s AI event recovery', (_scope, recoverEventsApi, endpoint, extraParams) => {
  beforeEach(() => vi.resetAllMocks())

  const createChat = () => useAiChat({
    recoverEventsApi,
    canSend: () => true,
    getConversationKey: () => 'thread-1',
    getExtraParams: threadId => ({ ...extraParams, threadId })
  })

  it('restores the pending question from the complete snapshot after refresh', async () => {
    const question = { questionId: 'question-1', prompt: '请选择范围', status: 'pending' }
    const snapshot = {
      events: [],
      lastSeq: 0,
      runStatus: 'waiting_for_user',
      executing: false,
      activeTurn: null,
      queuedTurns: [],
      pendingTurnCount: 0,
      pendingUserInput: question,
      stopReason: null
    }
    post.mockResolvedValue({ data: snapshot })
    const chat = createChat()
    chat.setMessages([{ role: 'assistant', content: '', nodes: [{ kind: 'user_input', ...question }] }])

    const result = await chat.recoverConversation()

    expect(post).toHaveBeenCalledWith(endpoint, { ...extraParams, threadId: 'thread-1', afterSeq: 0, limit: 200 })
    expect(result.snapshot).toBe(snapshot)
    expect(result.caughtUp).toBe(true)
    expect(chat.conversationStatus.value['thread-1']).toMatchObject({
      status: 'waiting_for_user', sending: false, pendingUserInput: question
    })
    expect(chat.messages.value[0].nodes[0].status).toBe('pending')
  })

  it('propagates snapshot failures without replacing the active state', async () => {
    const error = new Error('network unavailable')
    post.mockRejectedValue(error)
    const chat = createChat()
    chat.applyRecoveredEvents({ events: [], lastSeq: 0, runStatus: 'running' })

    await expect(chat.recoverConversation()).rejects.toBe(error)

    expect(chat.conversationStatus.value['thread-1']).toMatchObject({ status: 'running', sending: true })
  })
})
