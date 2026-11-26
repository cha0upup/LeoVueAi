import { describe, expect, it } from 'vitest'

import {
  AI_PROTOCOL,
  buildCapabilityBody,
  capabilityIdentityLabel,
  defaultPathForProtocol,
  normalizeProtocol,
  normalizeModelNameForCapability,
  modelRequestControls,
  providerTestModelId
} from './aiChannelSettingsModel.js'

describe('aiChannelSettingsModel', () => {
  it('keeps request options and labels aligned with the backend contract', () => {
    const controls = modelRequestControls({ requestOptions: {
      reasoningEfforts: ['minimal', 'high'], responsesRequiredForTools: true
    } })

    expect(controls.reasoningOptions).toEqual([
      { label: 'auto', value: 'auto' }, { label: 'minimal', value: 'minimal' }, { label: 'high', value: 'high' }
    ])
    expect(controls.responsesRequiredForTools).toBe(true)
  })

  it.each(['openrouter', 'ollama'])('keeps %s controls tied to its gateway rather than a direct-vendor contract', provider => {
    const controls = modelRequestControls({ requestOptions: {
      thinkingRequired: true, reasoningEfforts: [], temperatureConfigurable: false
    } }, provider)
    expect(controls.reasoningOptions.map(option => option.value)).toEqual(['auto'])
    expect(controls.reasoningModeOptions.map(option => option.value)).toEqual([null, 1, 0])
    expect(controls.temperatureConfigurable).toBe(true)
  })

  it('shows no guessed levels before a contract arrives, through an unverified gateway, or while thinking is off', () => {
    expect(modelRequestControls(null).reasoningOptions.map(option => option.value)).toEqual(['auto'])
    expect(modelRequestControls({ requestOptions: {
      source: 'gateway', reasoningEfforts: ['low', 'medium', 'high', 'xhigh', 'max']
    } }, 'openrouter').reasoningOptions.map(option => option.value)).toEqual(['auto'])
    expect(modelRequestControls({ requestOptions: {
      source: 'official', reasoningEfforts: ['low', 'high', 'max']
    } }, 'deepseek', 0).reasoningOptions.map(option => option.value)).toEqual(['auto'])
  })
  it('normalizes protocol values and their default paths', () => {
    expect(normalizeProtocol(AI_PROTOCOL.responses)).toBe(AI_PROTOCOL.responses)
    expect(defaultPathForProtocol(AI_PROTOCOL.responses)).toBe('/responses')
    expect(normalizeProtocol('unexpected')).toBe(AI_PROTOCOL.chatCompletions)
    expect(defaultPathForProtocol('unexpected')).toBe('/chat/completions')
  })

  it('selects the same model used by provider connection testing', () => {
    expect(providerTestModelId({ models: [] })).toBeNull()
    expect(providerTestModelId({ models: [{ id: 1, enabled: 0 }, { id: 2, enabled: 1 }] }))
      .toBe(2)
    expect(providerTestModelId({ models: [{ id: 1, enabled: 0 }] })).toBe(1)
  })

  it('normalizes aggregator model names and serializes capability flags', () => {
    expect(normalizeModelNameForCapability('openai/gpt-5', 'custom')).toBe('gpt-5')
    expect(normalizeModelNameForCapability('kimi/kimi-k3.1-pro', 'custom')).toBe('kimi-k3.1-pro')
    expect(normalizeModelNameForCapability('moonshot/kimi-k2.6', 'custom')).toBe('kimi-k2.6')
    expect(normalizeModelNameForCapability('vendor/model', 'openrouter')).toBe('model')
    expect(normalizeModelNameForCapability('vendor/model', 'custom')).toBe('vendor/model')

    expect(
      buildCapabilityBody({
        modelName: ' model-a ',
        source: 'manual',
        contextWindowTokens: 100,
        maxOutputTokens: 20,
        supportsTextGenerationBool: true,
        supportsReasoningBool: false,
        supportsStreamingBool: true,
        supportsFunctionCallingBool: false,
        supportsStructuredOutputBool: false,
        supportsWebSearchBool: false,
        supportsParallelToolCallsBool: true,
        remark: ''
      })
    ).toMatchObject({
      modelName: 'model-a',
      supportsTextGeneration: 1,
      supportsReasoning: 0,
      supportsParallelToolCalls: 1
    })
  })

  it('uses the resolved capability identity before deriving one from the model', () => {
    expect(capabilityIdentityLabel(null)).toBe('')
    expect(capabilityIdentityLabel({ capabilityModelName: 'official-model', model: 'raw' }))
      .toBe('official-model')
    expect(capabilityIdentityLabel({ model: 'openai/gpt-5', providerKey: 'custom' }))
      .toBe('gpt-5')
  })
})
