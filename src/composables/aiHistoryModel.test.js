import { describe, expect, it } from 'vitest'
import { getThreadStatus } from '@/utils/aiRuntime.js'
import {
  buildRequestAttachments,
  findLatestAssistantPlan,
  mapPersistedMessages
} from './aiHistoryModel.js'

describe('aiHistoryModel', () => {
  it('prefers local status and finds the latest assistant plan', () => {
    expect(getThreadStatus(
      { threadId: 'thread-1', runStatus: 'idle' },
      { 'thread-1': { status: 'running' } }
    )).toBe('running')
    expect(findLatestAssistantPlan([
      { role: 'assistant', plan: { id: 1 } },
      { role: 'user' },
      { role: 'assistant', plan: { id: 2 } }
    ])).toEqual({ id: 2 })
  })

  it.each([false, true])('merges ordered history nodes with includeSubtasks=%s', includeSubtasks => {
    const serverMessages = [{
      role: 'assistant',
      content: 'final answer',
      timestamp: 1784073600000,
      nodes: [
        { kind: 'tool', seq: 3, toolCallId: 'tool-1', toolName: 'scan', status: 'running', businessTool: false, toolKind: 'CONTEXT' },
        { kind: 'thinking', seq: 1, content: 'think' },
        { kind: 'subtask', seq: 4, subagentInvocationId: 'sub-1', task: 'inspect', status: 'running' },
        { kind: 'text', seq: 2, content: 'answer' },
        { kind: 'tool', seq: 5, toolCallId: 'tool-1', success: true, resultPreview: 'ok' },
        { kind: 'subtask', seq: 6, subagentInvocationId: 'sub-1', status: 'completed', summary: 'done' }
      ]
    }]
    const original = globalThis.structuredClone(serverMessages)
    const [message] = mapPersistedMessages(serverMessages, { includeSubtasks })

    expect(message.nodes.map(node => node.kind)).toEqual(
      includeSubtasks ? ['thinking', 'text', 'tool', 'subtask'] : ['thinking', 'text', 'tool']
    )
    expect(message.nodes[2]).toMatchObject({ status: 'done', success: true, result: 'ok', businessTool: false, toolKind: 'CONTEXT' })
    if (includeSubtasks) expect(message.nodes[3]).toMatchObject({ status: 'completed', summary: 'done' })
    expect(message.startedAt).toBe(1784073600000)
    expect(serverMessages).toEqual(original)
  })

  it('restores protocol failures instead of showing stale pending messages as running', () => {
    const messages = mapPersistedMessages([
      { role: 'user', turnId: 'turn-1', content: 'retry me', status: 'pending' },
      {
        role: 'assistant',
        turnId: 'turn-1',
        content: '',
        status: 'pending',
        runStatus: 'running',
        protocolStatus: 'failed',
        protocolErrorMessage: '模型调用失败'
      }
    ])

    expect(messages[1]).toMatchObject({
      content: '调用失败：模型调用失败',
      loading: false,
      failed: true,
      retryText: 'retry me',
      errorMeta: { message: '模型调用失败' },
      runtime: { status: 'failed' }
    })
  })

  it('uses narration for a standalone final answer and strips attachment display fields', () => {
    const [message] = mapPersistedMessages([{ role: 'assistant', content: 'final answer' }])
    expect(message.nodes).toHaveLength(1)
    expect(message.nodes[0]).toMatchObject({ kind: 'narration', content: 'final answer' })
    expect(buildRequestAttachments([{ name: 'a', mimeType: 'text/plain', size: 1, content: 'x', url: 'ignored' }]))
      .toEqual([{ name: 'a', mimeType: 'text/plain', size: 1, content: 'x' }])
  })

  it.each(['CONFIRMATION', 'CLARIFICATION'])('restores persisted %s nodes', type => {
    const [message] = mapPersistedMessages([{ role: 'assistant', nodes: [{
      kind: 'user_input', seq: 3, questionId: 'question-1',
      type, prompt: '确认删除吗？', options: [
        { label: '确认', value: 'confirm', intent: 'confirm' },
        { label: '取消', value: 'cancel', intent: 'cancel' }
      ],
      allowFreeText: false, risk: 'HIGH', status: 'pending'
    }] }])

    expect(message.nodes[0]).toMatchObject({
      kind: 'user_input', questionId: 'question-1', type, risk: 'HIGH', status: 'pending'
    })
  })

  it('marks historical questions answered from later turn metadata', () => {
    const messages = mapPersistedMessages([
      { role: 'assistant', turnId: 'turn-question', nodes: [{
        kind: 'user_input', questionId: 'question-1', prompt: '选择范围', status: 'pending'
      }] },
      { role: 'user', turnId: 'turn-answer', answerToQuestionId: 'question-1', content: '当前节点' },
      { role: 'assistant', turnId: 'turn-answer', answerToQuestionId: 'question-1', content: 'done' }
    ])
    expect(messages.map(message => message.role)).toEqual(['assistant', 'assistant'])
    expect(messages[0].nodes[0]).toMatchObject({ status: 'answered', answer: '当前节点' })
  })

  it.each([
    ['inProgress', 'queued', null, 'queued', true],
    ['inProgress', 'cancelling', null, 'cancelling', true],
    ['inProgress', 'running', 'completed', 'completed', false],
    ['interrupted', 'interrupted', 'running', 'cancelled', false]
  ])('restores %s/%s history with runStatus=%s', (protocolStatus, dispatchStatus, runStatus, status, loading) => {
    const [message] = mapPersistedMessages([{
      role: 'assistant', timestamp: 1000, protocolStatus, dispatchStatus, runStatus
    }])

    expect(message).toMatchObject({
      loading,
      completedAt: loading ? null : 1000,
      runtime: { status, phase: status }
    })
  })
})
