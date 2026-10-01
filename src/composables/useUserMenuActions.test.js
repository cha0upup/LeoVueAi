import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deferred } from '@/test-support/deferred.js'
import { logoutApi } from '@/services/api/auth.js'
import { resetSessionState } from '@/services/sessionLifecycle.js'
import { confirmAction } from '@/utils/confirmUtils.js'
import { useUserMenuActions } from './useUserMenuActions.js'

vi.mock('@/services/api/auth.js', () => ({ logoutApi: vi.fn(), getLoginStatusApi: vi.fn() }))
vi.mock('@/utils/confirmUtils.js', () => ({ confirmAction: vi.fn() }))
vi.mock('@/utils/messageUtils.js', () => ({ showError: vi.fn(), showSuccess: vi.fn() }))

describe('user menu identity transitions', () => {
  beforeEach(() => {
    resetSessionState()
    vi.resetAllMocks()
  })

  it('does not sign a new user out after an old confirmation resolves', async () => {
    const confirmation = deferred()
    confirmAction.mockReturnValue(confirmation.promise)
    const actions = useUserMenuActions({ router: { push: vi.fn() } })
    const loggingOut = actions.handleLogout()
    resetSessionState()
    confirmation.resolve(true)
    await loggingOut
    expect(logoutApi).not.toHaveBeenCalled()
  })
})
