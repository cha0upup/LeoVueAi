import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PHP_TRAFFIC_DECODE,
  DEFAULT_PHP_TRAFFIC_ENCODE,
  applyDisguiseTemplate,
  buildDisguisePayload,
  buildDisguisePreviewPayload,
  createDisguiseEditorForm,
  createDisguiseIdPreview,
  filterSystemDisguiseTemplates,
  normalizeDisguiseRuntimes,
  resolveDisguiseHeadersStatus,
  stringifyDisguiseHeaders
} from './disguiseEditorModel.js'

describe('disguiseEditorModel', () => {
  it('normalizes runtimes and hydrates PHP defaults without dropping Java', () => {
    expect(normalizeDisguiseRuntimes(['PHP', 'unknown'])).toEqual(['java', 'php'])
    const form = createDisguiseEditorForm({ supportedRuntimes: ['php'] })
    expect(form.supportedRuntimes).toEqual(['java', 'php'])
    expect(form.phpTrafficEncodeBody).toBe(DEFAULT_PHP_TRAFFIC_ENCODE)
    expect(form.phpTrafficDecodeBody).toBe(DEFAULT_PHP_TRAFFIC_DECODE)
  })

  it('normalizes headers and reports structural errors', () => {
    expect(stringifyDisguiseHeaders('{"A":"B"}')).toBe('{\n  "A": "B"\n}')
    expect(resolveDisguiseHeadersStatus('{"A":1}')).toEqual({
      state: 'valid',
      message: '合法 JSON · 1 个字段'
    })
    expect(resolveDisguiseHeadersStatus('[]').state).toBe('invalid')
  })

  it('builds canonical save and preview payloads', () => {
    const form = createDisguiseEditorForm({
      disguiseName: ' demo ',
      headers: { A: 'B' },
      supportedRuntimes: ['php']
    })
    const payload = buildDisguisePayload(form)
    expect(payload).toMatchObject({
      disguiseName: 'demo',
      supportedRuntimes: ['java', 'php'],
      trafficEncodeBody: expect.stringContaining('encodeTraffic'),
      trafficDecodeBody: expect.stringContaining('decodeTraffic'),
      schemaVersion: 3,
      protocolVersion: 3,
      requirements: { php: { minVersion: '5.6', extensions: ['json'] } }
    })
    expect(buildDisguisePreviewPayload(form)).toMatchObject({
      trafficEncodeBody: expect.stringContaining('encodeTraffic'),
      trafficDecodeBody: expect.stringContaining('decodeTraffic')
    })
  })

  it('applies templates while retaining the current primary key', () => {
    const form = createDisguiseEditorForm({ disguiseId: 'existing', disguiseName: 'old' })
    applyDisguiseTemplate(form, { disguiseId: 'template', disguiseName: 'new' })
    expect(form.disguiseId).toBe('existing')
    expect(form.disguiseName).toBe('new')
  })

  it('creates stable IDs and filters templates defensively', () => {
    expect(createDisguiseIdPreview({ disguiseName: ' Demo Name ', version: '' })).toBe('demo_name_1.0.0')
    expect(filterSystemDisguiseTemplates([
      { disguiseId: 'a', createUserId: 'system' },
      { disguiseId: 'custom_1.0.0' },
      { disguiseId: 'other' }
    ])).toHaveLength(2)
  })
})
