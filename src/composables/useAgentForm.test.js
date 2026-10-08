import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import { deferred } from '@/test-support/deferred.js'
import { createDefaultAgent } from '@/utils/constants.js'

const mocks = vi.hoisted(() => ({
  disguises: vi.fn(),
  testConfig: vi.fn(),
  probe: vi.fn(),
  showError: vi.fn(),
  showInfo: vi.fn(),
  showSuccess: vi.fn(),
  showWarning: vi.fn()
}))
vi.mock('@/services/api/disguises.js', () => ({ getDisguisesApi: mocks.disguises }))
vi.mock('@/services/api/agent-node.js', () => ({ testAgentConnectionConfigApi: mocks.testConfig }))
vi.mock('@/services/api/agent-manage.js', () => ({ probeUrlPathsApi: mocks.probe }))
vi.mock('@/utils/messageUtils.js', () => mocks)

import { useAgentForm } from './useAgentForm.js'

describe('useAgentForm', () => {
  const apps = []
  const mountForm = () => {
    let form
    const renderer = createTestRenderer()
    const app = renderer.createApp(defineComponent({
      setup() {
        form = useAgentForm()
        return () => null
      }
    }))
    app.mount(renderer.root)
    apps.push(app)
    form.formRef.value = {
      validate: vi.fn().mockResolvedValue(true),
      resetFields: vi.fn(),
      clearValidate: vi.fn(),
      scrollToTop: vi.fn()
    }
    return form
  }

  beforeEach(() => {
    vi.resetAllMocks()
    mocks.disguises.mockResolvedValue({ data: [{ disguiseId: 'disguise-1' }] })
    mocks.testConfig.mockResolvedValue({ data: { success: true, latencyMs: 12 } })
  })
  afterEach(() => {
    for (const app of apps.splice(0)) app.unmount()
  })

  it('loads disguises on mount and keeps state isolated between dialogs', async () => {
    const add = mountForm()
    const edit = mountForm()
    await nextTick()
    await nextTick()

    expect(mocks.disguises).toHaveBeenCalledTimes(2)
    expect(add.allDisguises.value).toEqual([{ disguiseId: 'disguise-1' }])
    add.agent.agentName = 'new node'
    add.proxyEnabled.value = true
    add.applyPaddingPreset('light')
    expect(edit.agent).toEqual(createDefaultAgent())
    expect(edit.proxyEnabled.value).toBe(false)
    expect(edit.paddingPreset.value).toBe('')
    expect(edit.paddingForm.minBytes).toBe(64)
    add.scrollFormToTop()
    expect(add.formRef.value.scrollToTop).toHaveBeenCalledOnce()
  })

  it('serializes the live form for both submission and connection tests without mutating it', async () => {
    const form = mountForm()
    form.agent.headers = 'X-Token: value:with:colons\nX-Mode: test'
    form.agent.connLink = 'https://example.test/runtime'
    form.proxyEnabled.value = true
    form.urlStrategyEnabled.value = true
    form.urlStrategyForm.urlPoolText = ' /one \n\n/two'
    form.paddingEnabled.value = true
    form.applyPaddingPreset('light')
    form.headerNoiseEnabled.value = true
    form.tlsFingerprintEnabled.value = true
    await nextTick()

    const payload = form.buildAgentPayload()
    expect(payload.headers).toBe('{"X-Token":"value:with:colons","X-Mode":"test"}')
    expect(payload.proxyEnabled).toBe(1)
    expect(JSON.parse(payload.urlStrategy)).toEqual({
      enabled: true, mode: 'POOL', prefix: null, urlPool: ['/one', '/two']
    })
    expect(JSON.parse(payload.paddingStrategy)).toEqual({
      enabled: true, lengthDistribution: 'UNIFORM', minBytes: 16, maxBytes: 128
    })
    expect(JSON.parse(payload.headerNoiseStrategy)).toEqual({
      enabled: true, valueMode: 'RANDOM_ALPHANUM', minHeaders: 1, maxHeaders: 5
    })
    expect(JSON.parse(payload.tlsFingerprintStrategy)).toEqual({ enabled: true, profile: 'CHROME_MODERN' })
    expect(form.agent.headers).toBe('X-Token: value:with:colons\nX-Mode: test')
    expect(form.agent.proxyEnabled).toBe(0)
    await form.testConnection()
    expect(mocks.testConfig).toHaveBeenCalledWith(payload)
    expect(form.testResult.value).toEqual({ success: true, latencyMs: 12 })
    expect(form.testingConnection.value).toBe(false)
  })

  it.each([1, '1', 0])('loads stored configuration with proxy flag %s', async (proxyFlag) => {
    const form = mountForm()
    const saved = {
      agentId: 'node-1', agentName: 'stored node', type: 'php', proxyEnabled: proxyFlag,
      headers: '{"X-Token":"stored"}',
      urlStrategy: '{"enabled":true,"mode":"POOL","urlPool":["/stored"]}',
      paddingStrategy: '{"enabled":true,"minBytes":0,"maxBytes":128}',
      headerNoiseStrategy: '{"enabled":true,"minHeaders":0,"maxHeaders":3}',
      tlsFingerprintStrategy: '{"enabled":true,"profile":"FIREFOX_MODERN","rotate":true}'
    }
    form.loadAgent(saved)
    await nextTick()

    expect(form.agent.headers).toBe('X-Token: stored')
    expect(form.proxyEnabled.value).toBe(proxyFlag !== 0)
    expect(form.urlStrategyForm.urlPoolText).toBe('/stored')
    expect(form.paddingForm.minBytes).toBe(0)
    expect(form.headerNoiseForm.minHeaders).toBe(0)
    expect(form.tlsFingerprintForm.rotate).toBe(true)
    expect(form.buildAgentPayload()).toMatchObject({
      agentId: 'node-1', headers: saved.headers, proxyEnabled: proxyFlag === 0 ? 0 : 1
    })
    expect(saved.headers).toBe('{"X-Token":"stored"}')
  })

  it('clears strategies when a later configuration has empty or malformed JSON', () => {
    const form = mountForm()
    form.loadAgent({ urlStrategy: '{"enabled":true,"urlPool":["/old"]}' })
    form.loadAgent({ headers: '', urlStrategy: 'malformed JSON' })
    expect(form.urlStrategyForm.urlPoolText).toBe('')
    expect(form.buildAgentPayload()).toMatchObject({
      headers: '{}', proxyEnabled: 0, urlStrategy: '', paddingStrategy: '',
      headerNoiseStrategy: '', tlsFingerprintStrategy: ''
    })
  })

  it('shares validation and dynamically requires a payload key only for Java', async () => {
    const form = mountForm()
    form.formRef.value.validate.mockResolvedValue(false)
    await form.testConnection()
    expect(mocks.testConfig).not.toHaveBeenCalled()
    expect(mocks.showError).toHaveBeenCalledWith('表单验证失败，请检查输入')

    const callback = vi.fn()
    const { validator } = form.rules.payloadKey[0]
    validator({}, '', callback)
    expect(callback).toHaveBeenLastCalledWith(expect.any(Error))
    form.agent.type = 'php'
    validator({}, '', callback)
    expect(callback).toHaveBeenLastCalledWith()
  })

  it.each([
    ['agent fields', (form) => { form.agent.connLink = 'https://changed.test' }],
    ['proxy', (form) => { form.proxyEnabled.value = true }],
    ['URL switch', (form) => { form.urlStrategyEnabled.value = true }],
    ['URL settings', (form) => { form.urlStrategyForm.urlPoolText = '/changed' }],
    ['padding switch', (form) => { form.paddingEnabled.value = true }],
    ['padding preset', (form) => { form.paddingPreset.value = 'light' }],
    ['padding settings', (form) => { form.paddingForm.minBytes = 0 }],
    ['header switch', (form) => { form.headerNoiseEnabled.value = true }],
    ['header settings', (form) => { form.headerNoiseForm.minHeaders = 0 }],
    ['TLS switch', (form) => { form.tlsFingerprintEnabled.value = true }],
    ['TLS settings', (form) => { form.tlsFingerprintForm.rotate = true }]
  ])('invalidates connection results when %s change', async (_label, change) => {
    const form = mountForm()
    await form.testConnection()
    expect(form.testResult.value.success).toBe(true)
    change(form)
    await nextTick()
    expect(form.testResult.value).toBeNull()
  })

  it('discards an in-flight connection result when the form changes', async () => {
    const form = mountForm()
    const request = deferred()
    mocks.testConfig.mockReturnValue(request.promise)
    const pending = form.testConnection()
    await nextTick()
    await nextTick()
    expect(form.testingConnection.value).toBe(true)
    form.agent.agentName = 'changed'
    await nextTick()
    request.resolve({ data: { success: true } })
    await pending
    expect(form.testResult.value).toBeNull()
    expect(form.testingConnection.value).toBe(false)
  })

  it('resets values and validation while discarding stale test and probe responses', async () => {
    const form = mountForm()
    form.loadAgent({ connLink: 'https://example.test', headers: '{"X-Token":"stored"}' })
    form.proxyEnabled.value = true
    form.urlStrategyEnabled.value = true
    form.paddingEnabled.value = true
    form.headerNoiseEnabled.value = true
    form.tlsFingerprintEnabled.value = true
    form.applyPaddingPreset('light')
    await nextTick()
    const testRequest = deferred()
    const probeRequest = deferred()
    mocks.testConfig.mockReturnValue(testRequest.promise)
    mocks.probe.mockReturnValue(probeRequest.promise)
    const testing = form.testConnection()
    const probing = form.handleProbe()
    await nextTick()
    await nextTick()
    expect(form.testingConnection.value).toBe(true)
    expect(form.probing.value).toBe(true)
    form.resetForm()
    testRequest.reject(new Error('stale test failure'))
    probeRequest.resolve({ data: { success: true, paths: ['/stale'] } })
    await Promise.all([testing, probing])

    expect(form.formRef.value.resetFields).toHaveBeenCalledOnce()
    expect(form.formRef.value.clearValidate).toHaveBeenCalledOnce()
    expect(form.agent).toEqual(createDefaultAgent())
    expect(form.paddingPreset.value).toBe('')
    expect(form.paddingForm.minBytes).toBe(64)
    expect(form.urlStrategyForm.urlPoolText).toBe('')
    expect(form.buildAgentPayload()).toMatchObject({
      proxyEnabled: 0, headers: '{}', urlStrategy: '', paddingStrategy: '',
      headerNoiseStrategy: '', tlsFingerprintStrategy: ''
    })
    expect(form.testingConnection.value).toBe(false)
    expect(form.probing.value).toBe(false)
    expect(form.testResult.value).toBeNull()
    expect(mocks.showError).not.toHaveBeenCalled()
    expect(mocks.showSuccess).not.toHaveBeenCalled()
  })
})
