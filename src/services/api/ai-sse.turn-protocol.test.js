import { describe, expect, it, vi } from 'vitest'
import { parseAiSseStream } from './ai-sse.js'

describe('parseAiSseStream Turn protocol', () => {
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
