import { describe, expect, it, vi } from 'vitest'

import { generatePayloadKey } from './payloadKey.js'

describe('generatePayloadKey', () => {
  it('generates a printable random input using the browser CSPRNG', () => {
    vi.stubGlobal('crypto', {
      getRandomValues(bytes) {
        bytes.fill(0xab)
        return bytes
      }
    })

    expect(generatePayloadKey()).toMatch(/^[0-9a-z]{8}$/)

    vi.unstubAllGlobals()
  })

  it('fails when secure random values are unavailable', () => {
    vi.stubGlobal('crypto', {})

    expect(() => generatePayloadKey()).toThrow('当前环境不支持安全随机数生成')

    vi.unstubAllGlobals()
  })
})
