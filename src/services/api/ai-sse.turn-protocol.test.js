import { describe, expect, it, vi } from 'vitest'
import { parseAiSseStream } from './ai-sse.js'
import { createAiChatEventReducer } from '@/composables/aiChatEventReducer.js'
import { createAssistantMessage } from '@/composables/aiMessageFactory.js'

describe('parseAiSseStream Turn protocol', () => {
  it('renders thinking and plan updates through node and patch events', async () => {
    const assistant = createAssistantMessage()
    const state = { messages: [assistant], status: 'running', lastEventSeq: 0 }
    const reducer = createAiChatEventReducer({
      ensureState: () => state,
      getActiveKey: () => 'thread-1'
    })
    const events = [
      ['turn/started', { turn: { id: 'turn-1', status: 'running' } }],
      ['delta', 'draft'],
      ['node', { kind: 'thinking', content: 'Consider the request' }],
      ['node', { kind: 'plan', planId: 'plan-1', steps: [{ index: 0, description: 'Prepare answer', status: 'PENDING' }] }],
      ['patch', { kind: 'plan', stepIndex: 0, action: 'start', status: 'IN_PROGRESS' }],
      ['patch', { kind: 'plan', stepIndex: 0, action: 'complete', status: 'COMPLETED', result: 'Ready' }],
      ['heartbeat', { status: 'running', lastSeq: 6 }],
      ['turn', { content: 'Final answer' }],
      ['turn/completed', { turn: { id: 'turn-1', status: 'completed' } }]
    ]
    const body = events.map(([name, data], index) =>
      `id: ${index + 1}|turn-1|||\nevent: ${name}\ndata: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`
    ).join('')

    await parseAiSseStream(new globalThis.Response(body), reducer.makeLogHandlers('thread-1', 0))

    expect(assistant.nodes.slice(0, 2)).toMatchObject([
      { kind: 'text', content: 'draft', streaming: false },
      { kind: 'thinking', content: 'Consider the request' }
    ])
    expect(assistant.plan.steps[0]).toMatchObject({ status: 'COMPLETED', result: 'Ready' })
    expect(assistant.planEvents.map(event => event.action)).toEqual(['start', 'complete'])
    expect(state.heartbeat).toEqual({ status: 'running', lastSeq: 6 })
    expect(state.lastEventSeq).toBe(events.length)
    expect(state.status).toBe('completed')
    expect(assistant.content).toBe('Final answer')
    expect(assistant.loading).toBe(false)
  })

  it('keeps reading after model turn and finishes on turn/completed', async () => {
    const onTurn = vi.fn()
    const onTurnStarted = vi.fn()
    const onTurnCompleted = vi.fn()
    const body = [
      'id: 1',
      'event: turn/started',
      'data: {"turn":{"id":"turn-1","status":"inProgress"}}',
      '',
      'id: 2|turn-1|item-assistant-1|run-1|',
      'event: turn',
      'data: {"content":"partial result"}',
      '',
      'id: 3',
      'event: turn/completed',
      'data: {"turn":{"id":"turn-1","status":"interrupted"}}',
      '',
      ''
    ].join('\n')

    const reply = await parseAiSseStream(new globalThis.Response(body, {
      headers: { 'Content-Type': 'text/event-stream' }
    }), { onTurn, onTurnStarted, onTurnCompleted })

    expect(reply).toBe('partial result')
    expect(onTurnStarted).toHaveBeenCalledOnce()
    expect(onTurn).toHaveBeenCalledOnce()
    expect(onTurn).toHaveBeenCalledWith(
      expect.any(Object),
      2,
      expect.objectContaining({
        turnId: 'turn-1',
        itemId: 'item-assistant-1',
        runId: 'run-1'
      })
    )
    expect(onTurnCompleted).toHaveBeenCalledOnce()
  })

  it('keeps a thread subscription alive across consecutive turns', async () => {
    const onTurnStarted = vi.fn()
    const onTurnCompleted = vi.fn()
    const body = [
      'id: 1|turn-a|||',
      'event: turn/started',
      'data: {"turn":{"id":"turn-a","status":"running"}}',
      '',
      'id: 2|turn-a|||',
      'event: turn/completed',
      'data: {"turn":{"id":"turn-a","status":"interrupted"}}',
      '',
      'id: 3|turn-b|||',
      'event: turn/started',
      'data: {"turn":{"id":"turn-b","status":"running"}}',
      '',
      'id: 4|turn-b|||',
      'event: turn/completed',
      'data: {"turn":{"id":"turn-b","status":"completed"}}',
      '',
      ''
    ].join('\n')

    await parseAiSseStream(new globalThis.Response(body, {
      headers: { 'Content-Type': 'text/event-stream' }
    }), { onTurnStarted, onTurnCompleted })

    expect(onTurnStarted).toHaveBeenCalledTimes(2)
    expect(onTurnCompleted).toHaveBeenCalledTimes(2)
  })

  it('rejects clean EOF after turn/started when terminal event is missing', async () => {
    const onEventSeq = vi.fn()
    const body = [
      'id: 1|turn-1|item-1|run-1|',
      'event: turn/started',
      'data: {"turn":{"id":"turn-1","status":"inProgress"}}',
      '',
      'id: 2|turn-1|item-1|run-1|',
      'event: turn',
      'data: {"content":"model result"}',
      '',
      ''
    ].join('\n')

    await expect(parseAiSseStream(new globalThis.Response(body, {
      headers: { 'Content-Type': 'text/event-stream' }
    }), { onEventSeq })).rejects.toMatchObject({ code: 'AI_TURN_INCOMPLETE' })

    expect(onEventSeq).toHaveBeenCalledWith(2, expect.any(Object))
  })

  it('does not advance cursor when turn/completed payload is malformed', async () => {
    const onEventSeq = vi.fn()
    const body = [
      'id: 1|turn-1|item-1|run-1|',
      'event: turn/started',
      'data: {"turn":{"id":"turn-1","status":"inProgress"}}',
      '',
      'id: 2|turn-1|item-1|run-1|',
      'event: turn/completed',
      'data: {malformed',
      '',
      ''
    ].join('\n')

    await expect(parseAiSseStream(new globalThis.Response(body, {
      headers: { 'Content-Type': 'text/event-stream' }
    }), { onEventSeq })).rejects.toMatchObject({ code: 'AI_TURN_INCOMPLETE' })

    expect(onEventSeq).toHaveBeenCalledTimes(1)
    expect(onEventSeq).toHaveBeenCalledWith(1, expect.any(Object))
  })
})
