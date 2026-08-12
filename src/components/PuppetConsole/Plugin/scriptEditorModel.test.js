import { describe, expect, it } from 'vitest'
import {
  analyzeBytecode,
  buildPluginPayload,
  decodeBytecodeBase64,
  formatByteSize,
  formatExecutionResult,
  getScriptLanguageOptions
} from './scriptEditorModel.js'

describe('scriptEditorModel', () => {
  it('normalizes bytecode base64 and validates the class magic', () => {
    const descriptor = analyzeBytecode(Uint8Array.from([0xca, 0xfe, 0xba, 0xbe, 1]), 'Demo.class')
    const decoded = decodeBytecodeBase64(` ${descriptor.base64.slice(0, 4)}\n${descriptor.base64.slice(4)} `)
    expect(descriptor).toMatchObject({ fileName: 'Demo.class', size: 5, magicValid: true, preview: 'ca fe ba be 01' })
    expect(decoded).toMatchObject({ base64: descriptor.base64, size: 5, magicValid: true })
  })

  it('formats result envelopes and byte sizes', () => {
    expect(formatExecutionResult({ result: { ok: true } })).toBe('{\n  "ok": true\n}')
    expect(formatExecutionResult({ output: 'done' })).toBe('done')
    expect(formatByteSize(1536)).toBe('1.5 KB')
    expect(getScriptLanguageOptions('php')).toEqual([{ value: 'php', label: 'PHP' }])
  })

  it('builds runtime-aware script and class plugin payloads', () => {
    const form = { pluginName: ' demo ', pluginDescription: ' test ', version: '' }
    expect(buildPluginPayload({ form, mode: 'script', language: 'php', runtime: 'php', script: 'return 1;' }))
      .toMatchObject({ pluginName: 'demo', version: '1.0', pluginType: 'php', runtime: 'php', scriptContent: 'return 1;' })
    expect(buildPluginPayload({ form, mode: 'class', bytecode: { base64: 'yv66vg==' }, pluginParam: '{}' }))
      .toMatchObject({ pluginType: 'java', bytecode: 'yv66vg==', paramsDemo: '{}' })
  })
})
