import { describe, expect, it } from 'vitest'
import { createAiChatEventReducer } from './aiChatEventReducer.js'
import { createAssistantMessage } from './aiMessageFactory.js'

function fixture() {
  const assistant = createAssistantMessage()
  assistant.turnId = 'turn-1'
  const state = {
    messages: [assistant],
    status: 'running',
    sending: true,
    activeTurnId: 'turn-1',
    activeItemId: 'item-1',
    activeClientUserMessageId: 'client-1',
    lastEventSeq: 0,
    lastHeartbeatAt: null
  }
  const reducer = createAiChatEventReducer({
    ensureState: () => state,
    getActiveKey: () => 'thread-1'
  })
  return { state, assistant, handlers: reducer.makeLogHandlers('thread-1', 0) }
}

describe('aiChatEventReducer Turn protocol', () => {
  it('keeps the assistant active when model turn aggregate arrives', () => {
    const { state, assistant, handlers } = fixture()

    handlers.onTurn({ content: 'model result' }, 1, {
      turnId: 'turn-1',
      itemId: 'item-1',
      runId: 'run-1'
    })

    expect(state.status).toBe('running')
    expect(state.sending).toBe(true)
    expect(state.activeTurnId).toBe('turn-1')
    expect(assistant.loading).toBe(true)
    expect(assistant.content).toBe('model result')
    expect(assistant.runtime.phase).toBe('model_completed')
  })

  it('uses turn/completed as the only failed terminal event', () => {
    const { state, assistant, handlers } = fixture()

    handlers.onTurn({ content: '' }, 1, {
      turnId: 'turn-1',
      itemId: 'item-1',
      runId: 'run-1'
    })
    handlers.onTurnCompleted({
      turn: {
        id: 'turn-1',
        status: 'failed',
        error: { message: '模型调用失败' }
      }
    }, 2)

    expect(state.status).toBe('failed')
    expect(state.sending).toBe(false)
    expect(state.activeTurnId).toBeNull()
    expect(assistant.loading).toBe(false)
    expect(assistant.failed).toBe(true)
    expect(assistant.content).toBe('模型调用失败')
  })

  it('keeps the thread waiting after a structured question completes', () => {
    const { state, assistant, handlers } = fixture()

    handlers.onNode({
      kind: 'user_input',
      questionId: 'question-1',
      type: 'CLARIFICATION',
      prompt: '请选择目标范围',
      options: [
        { label: '当前节点', value: 'current', intent: 'select_current' },
        { label: '全部节点', value: 'all', intent: 'select_all' }
      ],
      allowFreeText: true,
      status: 'pending'
    }, 1, { turnId: 'turn-1', itemId: 'item-1' })
    handlers.onTurnCompleted({ turn: { id: 'turn-1', status: 'completed' } }, 2)

    expect(state.status).toBe('waiting_for_user')
    expect(state.sending).toBe(false)
    expect(state.pendingUserInput.questionId).toBe('question-1')
    expect(assistant.nodes.at(-1)).toMatchObject({
      kind: 'user_input',
      questionId: 'question-1',
      status: 'pending'
    })
  })

  it('clears the pending question when its answer turn starts', () => {
    const { state, assistant, handlers } = fixture()
    assistant.nodes = [{ kind: 'user_input', questionId: 'question-1', status: 'pending' }]
    state.pendingUserInput = assistant.nodes[0]
    state.status = 'waiting_for_user'
    state.sending = false

    handlers.onTurnStarted({
      turn: {
        id: 'turn-2',
        status: 'running',
        answerToQuestionId: 'question-1',
        items: [{ role: 'assistant', id: 'item-2' }]
      }
    }, 1)

    expect(state.pendingUserInput).toBeNull()
    expect(assistant.nodes[0].status).toBe('answered')
    expect(state.status).toBe('running')
  })
})
