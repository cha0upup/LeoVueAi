import { describe, expect, it } from 'vitest'
import {
  buildRequestAttachments,
  findLatestAssistantPlan,
  mapPersistedThreadMessages
} from './puppetAiAssistantModel.js'

describe('puppetAiAssistantModel', () => {
  it('rebuilds ordered nodes and merges tool patches by call id', () => {
    const [message] = mapPersistedThreadMessages([{ role: 'assistant', content: 'final answer', timestamp: 1, nodes: [
      { kind: 'tool', seq: 2, toolCallId: 'c1', toolName: 'exec', status: 'running' },
      { kind: 'thinking', seq: 1, content: 'think' },
      { kind: 'tool', seq: 3, toolCallId: 'c1', success: true, resultPreview: 'ok' }
    ] }])
    expect(message.nodes.map(node => node.kind)).toEqual(['thinking', 'tool', 'narration'])
    expect(message.nodes[1]).toMatchObject({ status: 'done', success: true, result: 'ok' })
  })

  it('does not append the final narration when persisted text segments exist', () => {
    const [message] = mapPersistedThreadMessages([{ role: 'assistant', content: 'duplicate', nodes: [{ kind: 'text', seq: 1, content: 'segment' }] }])
    expect(message.nodes).toHaveLength(1)
    expect(message.nodes[0]).toMatchObject({ kind: 'text', content: 'segment' })
  })

  it('restores protocol failures and retry text from persisted turn messages', () => {
    const messages = mapPersistedThreadMessages([
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

  it('derives latest plans and request attachment shape', () => {
    expect(findLatestAssistantPlan([{ role: 'assistant', plan: { id: 1 } }])).toEqual({ id: 1 })
    expect(buildRequestAttachments([{ id: 1, name: 'a', mimeType: 'text/plain', size: 1, content: 'x' }]))
      .toEqual([{ name: 'a', mimeType: 'text/plain', size: 1, content: 'x' }])
  })

  it('restores persisted clarification nodes', () => {
    const [message] = mapPersistedThreadMessages([{ role: 'assistant', nodes: [{
      kind: 'user_input', seq: 2, questionId: 'question-1',
      type: 'CLARIFICATION', prompt: '选择范围', status: 'pending'
    }] }])
    expect(message.nodes[0]).toMatchObject({
      kind: 'user_input', questionId: 'question-1', prompt: '选择范围'
    })
  })

  it('marks historical questions answered from later turn metadata', () => {
    const messages = mapPersistedThreadMessages([
      { role: 'assistant', turnId: 'turn-question', nodes: [{
        kind: 'user_input', questionId: 'question-1', prompt: '选择范围', status: 'pending'
      }] },
      { role: 'user', turnId: 'turn-answer', answerToQuestionId: 'question-1', content: '当前节点' },
      { role: 'assistant', turnId: 'turn-answer', answerToQuestionId: 'question-1', content: 'done' }
    ])
    expect(messages.map(message => message.role)).toEqual(['assistant', 'assistant'])
    expect(messages[0].nodes[0].status).toBe('answered')
  })
})
