import { describe, expect, it } from 'vitest'
import { createSseFrameDecoder } from './sseFrameDecoder.js'

describe('SSE frame decoding', () => {
  it.each(['\n', '\r\n', '\r'])('accepts %j line endings at every possible chunk boundary', ending => {
    const text = ['id: 7', 'event: delta', 'data:  hello ', 'data:', 'data: world', '', ''].join(ending)
    for (let boundary = 0; boundary <= text.length; boundary += 1) {
      const frames = []
      const decoder = createSseFrameDecoder((...frame) => frames.push(frame))
      decoder.push(text.slice(0, boundary))
      decoder.push('')
      decoder.push(text.slice(boundary))
      decoder.finish()
      expect(frames).toEqual([['delta', ' hello \n\nworld', '7']])
    }
  })

  it('ignores comments and retry fields and flushes an unterminated final data line', () => {
    const frames = []
    const decoder = createSseFrameDecoder((...frame) => frames.push(frame))
    decoder.push(': heartbeat\nretry: 1000\nevent: turn\ndata: {"content":"ok"}')
    decoder.finish()
    expect(frames).toEqual([['turn', '{"content":"ok"}', '']])
  })

  it('resets per-frame metadata and ignores ids containing NUL', () => {
    const frames = []
    const decoder = createSseFrameDecoder((...frame) => frames.push(frame))
    decoder.push('id: 1\nevent: delta\ndata: first\n\nid: bad\0id\nevent: delta\ndata: second\n\n')
    decoder.finish()
    expect(frames).toEqual([['delta', 'first', '1'], ['delta', 'second', '']])
  })
})
