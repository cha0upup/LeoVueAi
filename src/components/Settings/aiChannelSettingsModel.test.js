import { describe, expect, it } from 'vitest'

import {
  AI_PROTOCOL,
  buildProviderRows,
  buildCapabilityBody,
  capabilityIdentityLabel,
  defaultPathForProtocol,
  filterProviderRows,
  normalizeProtocol,
  normalizeModelNameForCapability,
  providerTestModelId,
  shortTokens
} from './aiChannelSettingsModel.js'

describe('aiChannelSettingsModel', () => {
  it('normalizes protocol values and their default paths', () => {
    expect(normalizeProtocol(AI_PROTOCOL.responses)).toBe(AI_PROTOCOL.responses)
    expect(defaultPathForProtocol(AI_PROTOCOL.responses)).toBe('/responses')
    expect(normalizeProtocol('unexpected')).toBe(AI_PROTOCOL.chatCompletions)
    expect(defaultPathForProtocol('unexpected')).toBe('/v1/chat/completions')
  })

  it('groups models under their provider rows', () => {
    const rows = buildProviderRows(
      [{ id: 1, name: 'OpenAI', providerKey: 'openai' }],
      [
        { id: 10, providerId: 1, model: 'gpt-a', isActive: 1 },
        { id: 20, providerId: 999, model: 'orphan-model' }
      ]
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ name: 'OpenAI', hasDefault: true })
    expect(rows[0].models.map((model) => model.model)).toEqual(['gpt-a'])
  })

  it('searches provider fields and nested model names', () => {
    const rows = buildProviderRows(
      [{ id: 1, name: 'Example', providerKey: 'custom', baseUrl: 'https://api.example.test' }],
      [{ id: 10, providerId: 1, name: 'Reasoning Model', model: 'reasoner-v1' }]
    )

    expect(filterProviderRows(rows, 'reasoner')).toHaveLength(1)
    expect(filterProviderRows(rows, 'missing')).toHaveLength(0)
  })

  it('formats compact token limits', () => {
    expect(shortTokens(32768)).toBe('33K')
    expect(shortTokens(1_500_000)).toBe('1.5M')
  })

  it('selects the same model used by provider connection testing', () => {
    expect(providerTestModelId({ models: [] })).toBeNull()
    expect(providerTestModelId({ models: [{ id: 1, enabled: 0 }, { id: 2, enabled: 1 }] }))
      .toBe(2)
    expect(providerTestModelId({ models: [{ id: 1, enabled: 0 }] })).toBe(1)
  })

  it('normalizes aggregator model names and serializes capability flags', () => {
    expect(normalizeModelNameForCapability('openai/gpt-5', 'custom')).toBe('gpt-5')
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
