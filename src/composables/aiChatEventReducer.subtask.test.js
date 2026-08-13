import { describe, expect, it } from 'vitest'
import { createAiChatEventReducer } from './aiChatEventReducer.js'
import { createAssistantMessage } from './aiMessageFactory.js'

describe('aiChatEventReducer Puppet AI subtask', () => {
  it('groups child tool events under the delegated subtask', () => {
    const state = {
      messages: [createAssistantMessage()],
      status: 'running',
      lastEventSeq: 0,
      lastHeartbeatAt: null
    }
    const reducer = createAiChatEventReducer({
      ensureState: () => state,
      getActiveKey: () => 'platform-thread'
    })
    const handlers = reducer.makeLogHandlers('platform-thread', 0)

    handlers.onNode({
      kind: 'subtask',
      subagentInvocationId: 'inv-1',
      puppetId: 'puppet-1',
      task: '执行 whoami',
      status: 'pending'
    }, 1)
    handlers.onSubagentEvent({
      subagentInvocationId: 'inv-1',
      eventName: 'node',
      eventData: {
        kind: 'tool',
        toolCallId: 'tool-1',
        toolName: 'exec',
        arguments: '{"command":"whoami"}',
        status: 'running'
      },
      childSeq: 1
    }, 2)
    handlers.onSubagentEvent({
      subagentInvocationId: 'inv-1',
      eventName: 'patch',
      eventData: {
        kind: 'tool',
        toolCallId: 'tool-1',
        toolName: 'exec',
        success: true,
        resultPreview: 'root'
      },
      childSeq: 2
    }, 3)
    handlers.onPatch({
      kind: 'subtask',
      subagentInvocationId: 'inv-1',
      status: 'completed',
      summary: '当前身份为 root'
    }, 4)

    const subtask = state.messages[0].nodes[0]
    expect(subtask.kind).toBe('subtask')
    expect(subtask.status).toBe('completed')
    expect(subtask.summary).toBe('当前身份为 root')
    expect(subtask.children).toHaveLength(1)
    expect(subtask.children[0]).toMatchObject({
      kind: 'tool',
      name: 'exec',
      status: 'done',
      result: 'root',
      success: true
    })
  })

  it('keeps delegated child user input inside the subtask children', () => {
    const state = {
      messages: [createAssistantMessage()],
      status: 'running',
      lastEventSeq: 0,
      lastHeartbeatAt: null
    }
    const reducer = createAiChatEventReducer({
      ensureState: () => state,
      getActiveKey: () => 'platform-thread'
    })
    const handlers = reducer.makeLogHandlers('platform-thread', 0)
    handlers.onNode({ kind: 'subtask', subagentInvocationId: 'inv-2', status: 'running' }, 1)
    handlers.onSubagentEvent({
      subagentInvocationId: 'inv-2',
      eventName: 'node',
      eventData: {
        kind: 'user_input',
        questionId: 'question-child-1',
        prompt: '确认执行删除',
        status: 'pending',
        type: 'CONFIRMATION',
        options: []
      },
      childSeq: 2
    }, 2)

    const subtask = state.messages[0].nodes[0]
    expect(subtask.children).toHaveLength(1)
    expect(subtask.children[0]).toMatchObject({
      kind: 'user_input',
      questionId: 'question-child-1',
      status: 'pending'
    })
  })
})
