import { describe, expect, it } from 'vitest'
import { resolveApiBaseUrl } from './apiBaseUrl.js'

describe('resolveApiBaseUrl', () => {
  it('uses the current origin for production deployments', () => {
    expect(resolveApiBaseUrl({ origin: 'https://leo.example.com' })).toBe(
      'https://leo.example.com'
    )
    expect(resolveApiBaseUrl({ origin: 'http://127.0.0.1:18083' }, '')).toBe(
      'http://127.0.0.1:18083'
    )
  })

  it('overrides only the port for split frontend development', () => {
    expect(resolveApiBaseUrl({ origin: 'http://127.0.0.1:3000' }, '8082')).toBe(
      'http://127.0.0.1:8082'
    )
  })
})
