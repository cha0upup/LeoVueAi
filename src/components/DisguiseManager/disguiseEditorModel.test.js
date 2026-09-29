import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DISGUISE_HEADERS,
  DEFAULT_PHP_TRAFFIC_DECODE,
  DEFAULT_PHP_TRAFFIC_ENCODE,
  applyDisguiseTemplate,
  buildDisguisePayload,
  buildDisguisePreviewPayload,
  createDisguiseEditorForm,
  createDisguiseIdPreview,
  filterSystemDisguiseTemplates,
  normalizeDisguiseRuntimes,
  resolveDisguiseHeadersStatus
} from './disguiseEditorModel.js'

describe('disguiseEditorModel', () => {
  it('preserves declared runtimes without inferring Java for PHP profiles', () => {
    expect(normalizeDisguiseRuntimes(['PHP', 'unknown'])).toEqual(['php'])
    expect(createDisguiseEditorForm().supportedRuntimes).toEqual(['java'])
    const form = createDisguiseEditorForm({ supportedRuntimes: ['php'] })
    expect(form.supportedRuntimes).toEqual(['php'])
    expect(form.phpTrafficEncodeBody).toBeUndefined()
    expect(form.phpTrafficDecodeBody).toBeUndefined()
  })

  it('does not fill missing metadata on an existing disguise', () => {
    const form = createDisguiseEditorForm({ supportedRuntimes: [] })
    expect(form.version).toBeUndefined()
    expect(form.schemaVersion).toBeUndefined()
    expect(form.protocolVersion).toBeUndefined()
    expect(form.trafficEncodeBody).toBeUndefined()
    expect(form.trafficDecodeBody).toBeUndefined()
  })

  it('loads header objects and keeps defaults separate from empty headers', () => {
    expect(createDisguiseEditorForm({ headers: { A: 'B' } }).headersText).toBe('{\n  "A": "B"\n}')
    expect(createDisguiseEditorForm({ headers: {} }).headersText).toBe('{}')
    expect(createDisguiseEditorForm().headersText).toBe(DEFAULT_DISGUISE_HEADERS)
    expect(createDisguiseEditorForm({ headers: null }).headersText).toBe(DEFAULT_DISGUISE_HEADERS)
  })

  it('reports structural errors in the user-entered headers', () => {
    expect(resolveDisguiseHeadersStatus('{"A":1}')).toEqual({
      state: 'valid',
      message: '合法 JSON · 1 个字段'
    })
    expect(resolveDisguiseHeadersStatus('[]').state).toBe('invalid')
  })

  it('builds canonical save and preview payloads', () => {
    const form = createDisguiseEditorForm()
    form.disguiseName = ' demo '
    form.headersText = '{"A":"B"}'
    form.supportedRuntimes = ['java', 'php']
    form.phpTrafficEncodeBody = DEFAULT_PHP_TRAFFIC_ENCODE
    form.phpTrafficDecodeBody = DEFAULT_PHP_TRAFFIC_DECODE
    const payload = buildDisguisePayload(form)
    expect(payload).toMatchObject({
      disguiseName: 'demo',
      headers: '{"A":"B"}',
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

  it.each([
    [{ disguiseName: ' Demo Name ', version: '' }, 'demo_name_1.0.0'],
    [{ disguiseId: ' Explicit_2 ', disguiseName: 'ignored' }, 'Explicit_2'],
    [{ disguiseName: '__ Demo+Name __', version: ' 2.1.0 ' }, 'demo_name_2.1.0'],
    [{ disguiseName: ' ! ', version: ' ' }, 'disguise_1.0.0']
  ])('uses the same stable ID for preview and post-save selection: %s', (payload, expected) => {
    expect(createDisguiseIdPreview(payload)).toBe(expected)
  })

  it('identifies system templates by ownership instead of version-like IDs', () => {
    const systemTemplates = [
      { disguiseId: 'builtin_1.0.0', createUserId: 'system' },
      { disguiseId: 'builtin_2.0.0', createUserId: 'system' }
    ]
    expect(filterSystemDisguiseTemplates([
      ...systemTemplates,
      { disguiseId: 'custom_1.0.0', createUserId: 'user' },
      { disguiseId: 'inner_custom_1.0.0', createUserId: 'user' },
      { disguiseId: 'unknown_1.0.0' },
      null
    ])).toEqual(systemTemplates)
    expect(filterSystemDisguiseTemplates(null)).toEqual([])
  })
})
