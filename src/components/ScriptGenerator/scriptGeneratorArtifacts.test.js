import { describe, expect, it } from 'vitest'
import {
  decodeClassArtifact,
  formatClassArtifactLabel,
  normalizeClassArtifacts,
  resolveClassArtifactFileName
} from './scriptGeneratorArtifacts.js'

const classBytes = Uint8Array.from([0xca, 0xfe, 0xba, 0xbe, 0x00, 0x00, 0x00, 0x34])
const classBase64 = btoa(String.fromCharCode(...classBytes))

describe('script generator class artifacts', () => {
  it('normalizes downloadable class descriptors', () => {
    const [artifact] = normalizeClassArtifacts([{
      role: ' Injector ',
      className: 'demo.GeneratedInjector',
      fileName: '../GeneratedInjector.class',
      sizeBytes: classBytes.length,
      contentEncoding: 'BASE64',
      content: `${classBase64}\n`
    }])

    expect(artifact.role).toBe('injector')
    expect(artifact.fileName).toBe('GeneratedInjector.class')
    expect(formatClassArtifactLabel(artifact)).toBe('Injector · 8 B')
    expect(decodeClassArtifact(artifact)).toEqual(classBytes)
  })

  it('derives a safe class filename and rejects corrupt payloads', () => {
    expect(resolveClassArtifactFileName({ className: 'a.b.Core' })).toBe('Core.class')
    expect(() => decodeClassArtifact({
      role: 'core',
      className: 'a.b.Core',
      sizeBytes: 4,
      contentEncoding: 'base64',
      content: btoa('test')
    })).toThrow('文件头校验失败')
  })

  it('drops incomplete response entries', () => {
    expect(normalizeClassArtifacts(null)).toEqual([])
    expect(normalizeClassArtifacts([{ role: 'core', className: 'Core' }])).toEqual([])
  })
})
