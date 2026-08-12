import { beforeEach, describe, expect, it, vi } from 'vitest'

const showError = vi.hoisted(() => vi.fn())

vi.mock('./messageUtils.js', () => ({ showError }))

import { handleError } from './errorHandler.js'

describe('handleError', () => {
  beforeEach(() => {
    showError.mockClear()
  })

  it('preserves the caller fallback when an HTTP response has no useful payload', () => {
    const message = handleError(
      { response: { status: 0, data: {} } },
      { defaultMessage: '刷新任务失败' }
    )

    expect(message).toBe('刷新任务失败')
    expect(showError).toHaveBeenCalledWith('刷新任务失败')
  })

  it('combines a known status message with backend detail', () => {
    const message = handleError(
      {
        response: { data: { code: 409, msg: '名称重复' } }
      },
      {
        defaultMessages: { 409: '保存冲突' }
      }
    )

    expect(message).toBe('保存冲突：名称重复')
  })

  it('prefers structured database categories over generic HTTP messages', () => {
    const message = handleError(
      {
        response: {
          data: {
            code: 503,
            msg: 'connection reset',
            errorCategory: 'CONNECTION_ERROR',
            retryable: true
          }
        }
      },
      { defaultMessage: '加载失败' }
    )

    expect(message).toBe('数据库连接中断，请检查网络和连接配置：connection reset')
  })
})
