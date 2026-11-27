import { beforeEach, describe, expect, it, vi } from 'vitest'

const showError = vi.hoisted(() => vi.fn())

vi.mock('./messageUtils.js', () => ({ showError }))

import { handleError } from './errorHandler.js'
import { formatDatabaseError } from './databaseError.js'

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
            sqlState: '08006'
          }
        }
      },
      { defaultMessage: '加载失败' }
    )

    expect(message).toBe('数据库连接中断，请检查网络和连接配置：connection reset（SQLState: 08006）')
  })

  it('shows the supplied tracing reference with the public message', () => {
    const traceId = '64122da2-4c38-4553-b801-92a52ad7014b'
    const message = handleError({ response: { data: { code: 500, msg: '清理审计日志失败', traceId } } })

    expect(message).toBe(`服务器错误：清理审计日志失败（追踪编号：${traceId}）`)
    expect(showError).toHaveBeenCalledWith(message)
  })
})

it('uses the message or the caller fallback for unclassified database errors', () => {
  expect(formatDatabaseError({ message: 'socket closed' }, '加载失败')).toBe('socket closed')
  expect(formatDatabaseError({}, '加载失败')).toBe('加载失败')
})
