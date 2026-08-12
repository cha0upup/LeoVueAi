import { describe, expect, it, vi } from 'vitest'
import { parseAiSseStream } from '@/services/api/ai-sse.js'
import { createAiChatEventReducer } from './aiChatEventReducer.js'
import { createAssistantMessage } from './aiMessageFactory.js'

describe('AI Turn trace protocol', () => {
  it('parses the trace SSE event with its sequence', async () => {
    const onTrace = vi.fn()
    const body = [
      'event: trace',
      'id: 7',
      'data: {"traceId":"trace-1","source":"platform","startedAt":100}',
      '',
      ''
    ].join('\n')

    await parseAiSseStream(new globalThis.Response(body, {
      headers: { 'Content-Type': 'text/event-stream' }
    }), { onTrace })

    expect(onTrace).toHaveBeenCalledWith({
      traceId: 'trace-1',
      source: 'platform',
      startedAt: 100
    }, 7)
  })

  it('binds trace, turn and run identities to the assistant runtime', () => {
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

    handlers.onTrace({ traceId: 'trace-1', source: 'platform' }, 1)
    handlers.onTurn({
      content: 'answer',
      trace: {
        traceId: 'trace-1',
        turnId: 'turn-1',
        runId: 'run-1'
      }
    }, 2)
    handlers.onTurnCompleted({
      turn: { id: 'turn-1', status: 'completed' }
    }, 3)

    expect(state.activeTrace).toEqual({
      traceId: 'trace-1',
      source: 'platform',
      turnId: 'turn-1',
      runId: 'run-1'
    })
    expect(state.messages[0].runtime).toMatchObject({
      traceId: 'trace-1',
      turnId: 'turn-1',
      runId: 'run-1',
      status: 'completed'
    })
  })
})
