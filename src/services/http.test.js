import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const handlers = {}
  const http = {
    interceptors: {
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

vi.mock('@/router.js', () => ({
  default: {
    currentRoute: mocks.currentRoute,
    replace: mocks.replace
  }
}))

vi.mock('@/composables/useAuth.js', () => ({
  useAuth: () => ({ resetAuth: mocks.resetAuth })
}))

vi.mock('./apiBaseUrl.js', () => ({
  resolveApiBaseUrl: () => 'http://localhost'
}))

globalThis.window = { location: { origin: 'http://localhost' } }

await import('./http.js')

describe('HTTP response redirect handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.currentRoute.value = { path: '/admin', fullPath: '/admin?tab=users' }
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
