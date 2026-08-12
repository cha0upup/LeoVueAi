import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PHP_DECODE,
  DEFAULT_PHP_ENCODE,
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
    expect(form.phpEncodeBody).toBe(DEFAULT_PHP_ENCODE)
    expect(form.phpDecodeBody).toBe(DEFAULT_PHP_DECODE)
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
      schemaVersion: 2,
      protocolVersion: 2,
      requirements: { php: { minVersion: '7.4', extensions: ['json'] } }
    })
    expect(buildDisguisePreviewPayload(form, '{"x":1}').testParams).toEqual({ x: 1 })
    expect(buildDisguisePreviewPayload(form, '[]').testParams).toBeUndefined()
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
