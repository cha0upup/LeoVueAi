import { describe, expect, it } from 'vitest'
import {
  buildFingerprintPayload,
  createEmptyFingerprintForm,
  loadFingerprintForm,
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

  it('normalizes HTTP requests', () => {
    const form = loadFingerprintForm({ rule: { requests: [{ body: 'PING', timeout: -1 }] } })
    expect(form.requestList).toEqual([
      { method: 'GET', path: '/', timeout: 0, headers: [], body: 'PING' }
    ])
    expect(createEmptyFingerprintForm()).not.toHaveProperty('protocol')
  })

  it('starts with one editable request but keeps an intentionally emptied list empty on save', () => {
    const form = loadFingerprintForm({ rule: { requests: [] } })
    expect(form.requestList).toEqual(createEmptyFingerprintForm().requestList)
    form.requestList.splice(0)
    expect(buildFingerprintPayload(form).rule.requests).toEqual([])
  })

  it.each([
    [null, 3000],
    ['', 3000],
    ['invalid', 3000],
    [-10, 0],
    [0, 0],
    [12.6, 13],
    [70000, 60000]
  ])('preserves timeout limits when loading and saving %s', (timeout, expected) => {
    const form = loadFingerprintForm({ rule: { requests: [{ timeout }] } })
    expect(form.requestList[0].timeout).toBe(expected)
    form.requestList[0].timeout = timeout
    expect(buildFingerprintPayload(form).rule.requests[0].timeout).toBe(expected)
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

  it('loads current tag arrays for editing and leaves missing tags empty', () => {
    expect(loadFingerprintForm({ tags: ['web', 'java'] }).tagsStr).toBe('web, java')
    expect(loadFingerprintForm({}).tagsStr).toBe('')
    expect(loadFingerprintForm({ tags: 'web,java' }).tagsStr).toBe('')
  })

  it('saves headers and HTTP bodies without mutating the editable request rows', () => {
    const form = loadFingerprintForm({
      rule: {
        requests: [
          { method: 'GET', body: 'ignored', headers: { Accept: ' text/plain ' } },
          { method: 'HEAD', body: 'ignored', headers: {} },
          { method: 'POST', body: ' body ', charset: 'GBK', maxBodyBytes: 0 }
        ]
      }
    })
    form.requestList[2].headers.push(
      { key: ' X ', value: 'first' },
      { key: 'X', value: ' last ' },
      { key: ' ', value: 'ignored' }
    )
    const before = globalThis.structuredClone(form)
    expect(buildFingerprintPayload(form).rule.requests).toEqual([
      { method: 'GET', path: '/', timeout: 3000, headers: { Accept: 'text/plain' } },
      { method: 'HEAD', path: '/', timeout: 3000 },
      {
        method: 'POST', path: '/', timeout: 3000, headers: { X: 'last' },
        body: 'body', charset: 'GBK', maxBodyBytes: 0
      }
    ])
    expect(form).toEqual(before)
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
      matchText: '{"field":"body","operator":"contains","value":"ok"}'
    })
    expect(payload).toEqual({
      name: 'Demo',
      tags: ['web-app'],
      info: { version: '1.0', author: 'A' },
      rule: {
        requests: [{ method: 'POST', path: '/x', timeout: 3000, headers: { X: 'y' }, body: 'z' }],
        match: { field: 'body', operator: 'contains', value: 'ok' }
      }
    })
  })
})
