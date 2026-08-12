import { describe, expect, it, vi } from 'vitest'
import { parseAiSseStream } from './ai-sse.js'

describe('parseAiSseStream subagent events', () => {
  it('dispatches nested Puppet AI events with the SSE sequence', async () => {
    const onSubagentEvent = vi.fn()
    const body = [
      'event: subagent_event',
      'id: 12',
      'data: {"subagentInvocationId":"inv-1","eventName":"delta","eventData":"root"}',
      '',
      ''
    ].join('\n')

    await parseAiSseStream(new globalThis.Response(body, {
      headers: { 'Content-Type': 'text/event-stream' }
    }), { onSubagentEvent })

    expect(onSubagentEvent).toHaveBeenCalledWith({
      subagentInvocationId: 'inv-1',
      eventName: 'delta',
      eventData: 'root'
    }, 12)
  })
})
