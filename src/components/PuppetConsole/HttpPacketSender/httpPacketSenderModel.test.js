import { describe, expect, it } from 'vitest'
import {
  buildFuzzMatchRules,
  buildPayloadsMap,
  buildRawHttpResponse,
  getContentLengthUpdate,
  normalizeFuzzSnapshot,
  normalizeRepeaterResponse,
  parseHostHeader,
  resolveHttpTarget
} from './httpPacketSenderModel.js'

describe('httpPacketSenderModel', () => {
  it('parses host headers including ports and bracketed IPv6 addresses', () => {
    expect(parseHostHeader('GET / HTTP/1.1\r\nHost: example.com:8080\r\n')).toEqual({ host: 'example.com', port: 8080 })
    expect(parseHostHeader('Host: [::1]:8443')).toEqual({ host: '[::1]', port: 8443 })
    expect(resolveHttpTarget('Host: example.com', { useTls: true })).toEqual({ host: 'example.com', port: 443 })
  })

  it('calculates UTF-8 content length without rewriting an already correct header', () => {
    expect(getContentLengthUpdate('POST / HTTP/1.1\nContent-Length: 1\n\n中文')).toEqual({ lineNumber: 2, text: 'Content-Length: 6' })
    expect(getContentLengthUpdate('POST / HTTP/1.1\nContent-Length: 6\n\n中文')).toBeNull()
  })

  it('normalizes bodies and builds raw responses defensively', () => {
    const response = normalizeRepeaterResponse({ statusCode: '200', responseHeaders: { A: ['1', '2'] }, body: { ok: true } }, 12)
    expect(response.bodyLength).toBe(16)
    expect(buildRawHttpResponse(response)).toContain('A: 1\nA: 2\n\n{\n  "ok": true\n}')
  })

  it('normalizes payloads, match rules and result order', () => {
    expect(buildPayloadsMap([{ name: ' id ', values: '1\r\n\n2' }])).toEqual({ id: ['1', '2'] })
    expect(buildFuzzMatchRules({ matchStatusCode: '200,999,200,302', matchBodyContains: ' ok ' })).toEqual({ statusCode: [200, 302], bodyContains: 'ok' })
    expect(normalizeFuzzSnapshot({ status: 'finished', results: [{ index: 2 }, { index: 1 }] }, 't1').results.map(item => item.index)).toEqual([1, 2])
  })
})
