import { describe, expect, it } from 'vitest'
import { normalizeHttpError } from './httpError.js'

describe('normalizeHttpError', () => {
  it('keeps the backend envelope code and message for real HTTP failures', () => {
    const error = new Error('Request failed with status code 409')
    error.response = {
      status: 409,
      data: { code: 409, msg: '同名文件已存在' }
    }

    expect(normalizeHttpError(error)).toEqual({ code: 409, message: '同名文件已存在' })
    expect(error.code).toBe(409)
    expect(error.message).toBe('同名文件已存在')
  })

  it('normalizes numeric string codes from API envelopes', () => {
    const error = new Error('Conflict')
    error.response = { data: { code: '409', msg: '版本冲突' } }

    expect(normalizeHttpError(error)).toEqual({ code: 409, message: '版本冲突' })
  })

  it('handles non-Error rejection values without throwing', () => {
    expect(normalizeHttpError('连接已断开')).toEqual({
      code: undefined,
      message: '连接已断开'
    })
    expect(normalizeHttpError(null)).toEqual({
      code: undefined,
      message: '请求失败'
    })
  })

  it('falls back to the transport status when no API envelope exists', () => {
    const error = new Error('Service unavailable')
    error.response = { status: 503, data: 'upstream unavailable' }

    expect(normalizeHttpError(error)).toEqual({
      code: 503,
      message: 'Service unavailable'
    })
  })
})
