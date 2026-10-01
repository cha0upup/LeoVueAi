import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registerSessionCleanup, resetSessionState, sessionGeneration } from './sessionLifecycle.js'

const mocks = vi.hoisted(() => {
  const handlers = {}
  const http = {
    interceptors: {
      request: {
        use: vi.fn(handler => { handlers.request = handler })
      },
      response: {
        use: vi.fn((fulfilled, rejected) => {
          handlers.fulfilled = fulfilled
          handlers.rejected = rejected
        })
      }
    }
  }
  return {
    handlers,
    http,
    replace: vi.fn(async () => {}),
    resetAuth: vi.fn(),
    currentRoute: { value: { path: '/admin', fullPath: '/admin?tab=users' } }
  }
})

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => mocks.http)
  }
}))

vi.mock('./apiBaseUrl.js', () => ({
  resolveApiBaseUrl: () => 'http://localhost'
}))

globalThis.window = { location: { origin: 'http://localhost' } }

const { configureHttpErrorHandling } = await import('./http.js')
configureHttpErrorHandling({
  getCurrentRoute: () => mocks.currentRoute.value,
  replaceRoute: mocks.replace
})
registerSessionCleanup('http-test', mocks.resetAuth)

describe('HTTP response redirect handling', () => {
  beforeEach(() => {
    resetSessionState()
    vi.clearAllMocks()
    mocks.currentRoute.value = { path: '/admin', fullPath: '/admin?tab=users' }
  })

  it('stamps requests with their login generation', () => {
    expect(mocks.handlers.request({ url: '/test' })).toMatchObject({
      url: '/test', sessionGeneration: sessionGeneration.value
    })
  })

  it('rejects a late success from the previous login before unwrapping its data', async () => {
    const config = mocks.handlers.request({})
    resetSessionState()
    vi.clearAllMocks()

    await expect(mocks.handlers.fulfilled({ config, data: { code: 200, data: 'old user data' } }))
      .rejects.toMatchObject({ code: 'SESSION_CHANGED' })
    expect(mocks.resetAuth).not.toHaveBeenCalled()
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it('does not log the new user out when an old request returns 401', async () => {
    const config = mocks.handlers.request({})
    resetSessionState()
    vi.clearAllMocks()

    await expect(mocks.handlers.rejected({ config, response: { status: 401, data: { code: 401 } } }))
      .rejects.toMatchObject({ code: 'SESSION_CHANGED' })
    expect(mocks.resetAuth).not.toHaveBeenCalled()
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it('replaces an expired protected route and preserves its return path', async () => {
    await expect(
      mocks.handlers.fulfilled({
        data: { code: 401, msg: '登录已过期' }
      })
    ).rejects.toMatchObject({ code: 401 })

    expect(mocks.resetAuth).toHaveBeenCalledOnce()
    expect(mocks.replace).toHaveBeenCalledWith({
      path: '/login',
      query: { redirect: '/admin?tab=users' }
    })
  })

  it('does not trigger a duplicate redirect when already on the target route', async () => {
    mocks.currentRoute.value = { path: '/main', fullPath: '/main' }

    await expect(
      mocks.handlers.fulfilled({
        data: { code: 403, msg: '权限不足' }
      })
    ).rejects.toMatchObject({ code: 403 })

    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it('preserves structured database error details for feature-level handling', async () => {
    await expect(
      mocks.handlers.fulfilled({
        data: {
          code: 504,
          msg: 'statement timed out',
          errorCategory: 'QUERY_TIMEOUT',
          sqlState: 'HYT00',
          retryable: true
        }
      })
    ).rejects.toMatchObject({
      code: 504,
      response: {
        data: {
          errorCategory: 'QUERY_TIMEOUT',
          sqlState: 'HYT00',
          retryable: true
        }
      }
    })
  })

  it('redirects a forced-password response to the password page', async () => {
    await expect(
      mocks.handlers.rejected({
        response: {
          status: 403,
          data: {
            code: 403,
            msg: '首次登录需先修改密码',
            data: { passwordChangeRequired: true }
          }
        }
      })
    ).rejects.toMatchObject({ code: 403 })

    expect(mocks.replace).toHaveBeenCalledWith('/change-password')
  })
})
