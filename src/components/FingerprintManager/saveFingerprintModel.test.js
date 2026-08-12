import { describe, expect, it } from 'vitest'
import {
  buildFingerprintPayload,
  findIncompleteVulnerabilities,
  loadFingerprintForm,
  normalizeRequestsForProtocol,
  parseFingerprintTags
} from './saveFingerprintModel.js'

describe('saveFingerprintModel', () => {
  it('normalizes requests when switching protocols', () => {
    expect(normalizeRequestsForProtocol([{ body: 'PING', timeout: -1 }], 'http')).toEqual([
      { method: 'GET', path: '/', timeout: 0, headers: [], body: 'PING' }
    ])
    expect(normalizeRequestsForProtocol([{ method: 'POST', body: 'x', timeout: 99999 }], 'tcp')).toEqual([
      { body: 'x', timeout: 60000 }
    ])
  })

  it('loads request and header data without sharing references', () => {
    const source = { protocol: 'http', rule: { requests: [{ path: '/health', headers: { A: 1 } }] } }
    const form = loadFingerprintForm(source)
    expect(form.requestList[0]).toMatchObject({ path: '/health', headers: [{ key: 'A', value: '1' }] })
    form.requestList[0].headers[0].value = 'changed'
    expect(source.rule.requests[0].headers.A).toBe(1)
  })

  it('deduplicates tags and produces a trimmed submission payload', () => {
    expect(parseFingerprintTags(' Web App,web-app, JAVA ')).toEqual(['web-app', 'java'])
    const payload = buildFingerprintPayload({
      protocol: 'http', name: ' Demo ', version: ' 1.0 ', tagsStr: 'Web App, web-app',
      infoAuthor: ' A ', requestList: [{ method: 'POST', path: ' /x ', headers: [{ key: ' X ', value: ' y ' }], body: ' z ' }],
      script: ' true ', vulnerabilityList: [{ title: ' Issue ', references: [{ value: ' url ' }] }]
    })
    expect(payload).toMatchObject({
      name: 'Demo', tags: ['web-app'], info: { version: '1.0', author: 'A' },
      rule: { requests: [{ method: 'POST', path: '/x', timeout: 3000, headers: { X: 'y' }, body: 'z' }], script: 'true' }
    })
  })

  it('detects partially filled vulnerabilities that have no title', () => {
    expect(findIncompleteVulnerabilities([{ title: '', references: [{ value: 'https://example.com' }] }, { title: '' }])).toHaveLength(1)
  })
})
