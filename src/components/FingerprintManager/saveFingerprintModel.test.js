import { describe, expect, it } from 'vitest'
import {
  buildFingerprintPayload,
  createEmptyFingerprintForm,
  findIncompleteVulnerabilities,
  loadFingerprintForm,
  normalizeRequests,
  parseFingerprintTags
} from './saveFingerprintModel.js'

describe('saveFingerprintModel', () => {
  it('round-trips version extraction and response limits independently from rule metadata', () => {
    const rule = {
      requests: [{ path: '/', charset: 'GBK', maxBodyBytes: 4096 }],
      match: { field: 'body', value: 'marker' },
      version: { request: 0, field: 'headers', prefix: 'nginx/' }
    }
    const form = loadFingerprintForm({ name: 'Nginx', info: { version: 'any' }, rule })
    const payload = buildFingerprintPayload(form)
    expect(payload.info.version).toBe('any')
    expect(payload.rule.version).toEqual(rule.version)
    expect(payload.rule.requests[0]).toMatchObject(rule.requests[0])
    form.versionExtractText = ''
    expect(buildFingerprintPayload(form).rule).not.toHaveProperty('version')
    form.versionExtractText = '[]'
    expect(() => buildFingerprintPayload(form)).toThrow('版本提取配置必须是 JSON 对象')
  })

  it('preserves a built-in uri when editing and saving the rule', () => {
    const form = loadFingerprintForm({ name: 'Actuator', rule: {
      requests: [{ uri: '/actuator', headers: { Accept: 'application/json' } }],
      match: { field: 'body', value: '_links' }
    } })
    expect(buildFingerprintPayload(form).rule.requests[0].path).toBe('/actuator')
  })

  it('normalizes HTTP requests', () => {
    expect(normalizeRequests([{ body: 'PING', timeout: -1 }])).toEqual([
      { method: 'GET', path: '/', timeout: 0, headers: [], body: 'PING' }
    ])
    expect(createEmptyFingerprintForm()).not.toHaveProperty('protocol')
  })

  it('loads request and header data without sharing references', () => {
    const source = {
      rule: {
        requests: [{ path: '/health', headers: { A: 1 } }],
        match: { field: 'body', operator: 'contains', value: 'ok' }
      }
    }
    const form = loadFingerprintForm(source)
    expect(form.requestList[0]).toMatchObject({
      path: '/health',
      headers: [{ key: 'A', value: '1' }]
    })
    form.requestList[0].headers[0].value = 'changed'
    expect(source.rule.requests[0].headers.A).toBe(1)
    expect(JSON.parse(form.matchText)).toEqual(source.rule.match)
  })

  it('deduplicates tags and produces a trimmed submission payload', () => {
    expect(parseFingerprintTags(' Web App,web-app, JAVA ')).toEqual(['web-app', 'java'])
    const payload = buildFingerprintPayload({
      name: ' Demo ',
      version: ' 1.0 ',
      tagsStr: 'Web App, web-app',
      infoAuthor: ' A ',
      requestList: [
        { method: 'POST', path: ' /x ', headers: [{ key: ' X ', value: ' y ' }], body: ' z ' }
      ],
      matchText: '{"field":"body","operator":"contains","value":"ok"}',
      vulnerabilityList: [{ title: ' Issue ', references: [{ value: ' url ' }] }]
    })
    expect(payload).toMatchObject({
      name: 'Demo',
      tags: ['web-app'],
      info: { version: '1.0', author: 'A' },
      rule: {
        requests: [{ method: 'POST', path: '/x', timeout: 3000, headers: { X: 'y' }, body: 'z' }],
        match: { field: 'body', operator: 'contains', value: 'ok' }
      }
    })
  })

  it('detects partially filled vulnerabilities that have no title', () => {
    expect(
      findIncompleteVulnerabilities([
        { title: '', references: [{ value: 'https://example.com' }] },
        { title: '' }
      ])
    ).toHaveLength(1)
  })
})
