import { beforeEach, expect, it, vi } from 'vitest'
import { ROUTE_PATHS } from '@/constants/app.js'
import { authPageTarget, resolveAuthNavigation } from '@/routerGuards.js'
import { deferred } from '@/test-support/deferred.js'

const getStatus = vi.hoisted(() => vi.fn())
vi.mock('vue-router', async (original) => {
  const router = await original()
  return { ...router, createWebHistory: router.createMemoryHistory }
})
vi.mock('@/services/api/auth.js', () => ({ getLoginStatusApi: getStatus }))
vi.mock('@/services/http.js', () => ({ configureHttpErrorHandling: vi.fn() }))
vi.mock('@/views/SetupView.vue', () => ({ default: {} }))
vi.mock('@/views/StartupCheckView.vue', () => ({ default: {} }))
vi.mock('@/views/LoginView.vue', () => ({ default: {} }))
vi.mock('@/views/AdminView.vue', () => ({ default: {} }))
vi.mock('@/views/ChangePasswordView.vue', () => ({ default: {} }))

const requiresSetup = { data: { isLoggedIn: false, initializationRequired: true } }
const installed = { data: { isLoggedIn: false, initializationRequired: false } }

beforeEach(() => {
  vi.resetModules()
  getStatus.mockReset()
})

it('reads status once on first setup redirection and still rechecks a later direct visit', async () => {
  getStatus.mockResolvedValueOnce(requiresSetup).mockResolvedValue(installed)
  const { default: router } = await import('./router.js')
  const redirect = '/admin?tab=statistics#latest'

  await router.push(redirect)
  expect(router.currentRoute.value).toMatchObject({ path: ROUTE_PATHS.setup, query: { redirect } })
  expect(getStatus).toHaveBeenCalledOnce()

  await router.push({ path: ROUTE_PATHS.setup, query: { redirect: ROUTE_PATHS.admin } })
  expect(router.currentRoute.value).toMatchObject({ path: ROUTE_PATHS.login, query: { redirect: ROUTE_PATHS.admin } })
  expect(getStatus).toHaveBeenCalledTimes(2)
})

it('reuses a recovered startup check when opening setup', async () => {
  const redirect = '/admin?tab=statistics'
  getStatus.mockRejectedValueOnce({ response: { status: 503, headers: { 'retry-after': '2' } } })
    .mockResolvedValue(requiresSetup)
  const { default: router } = await import('./router.js')
  const { useAuth } = await import('@/composables/useAuth.js')

  await router.push(redirect)
  expect(router.currentRoute.value).toMatchObject({ path: ROUTE_PATHS.startup, query: { redirect } })
  expect(getStatus).toHaveBeenCalledOnce()

  await useAuth().fetchAuth({ force: true })
  await router.replace(authPageTarget(ROUTE_PATHS.setup, redirect))
  expect(router.currentRoute.value).toMatchObject({ path: ROUTE_PATHS.setup, query: { redirect } })
  expect(getStatus).toHaveBeenCalledTimes(2)
})

it('retains the query and anchor if status already reports a logged-in user', async () => {
  getStatus.mockResolvedValue({ data: { ...installed.data, isLoggedIn: true, privilege: 'admin' } })
  const { default: router } = await import('./router.js')
  const redirect = '/admin?tab=statistics#latest'

  await router.push(authPageTarget(ROUTE_PATHS.login, redirect))
  expect(router.currentRoute.value.fullPath).toBe(redirect)
  expect(getStatus).toHaveBeenCalledOnce()
})

it('waits for an in-flight status refresh instead of briefly opening recovery', async () => {
  const pending = deferred()
  getStatus.mockResolvedValueOnce(installed).mockReturnValue(pending.promise)
  const { default: router } = await import('./router.js')
  const { useAuth } = await import('@/composables/useAuth.js')
  await router.push(ROUTE_PATHS.login)

  const refresh = useAuth().fetchAuth({ force: true })
  const navigation = router.push(ROUTE_PATHS.admin)
  const settled = vi.fn()
  void navigation.then(settled)
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(settled).not.toHaveBeenCalled()

  pending.resolve({ data: { ...installed.data, isLoggedIn: true, privilege: 'admin' } })
  await Promise.all([refresh, navigation])
  expect(getStatus).toHaveBeenCalledTimes(2)
  expect(router.currentRoute.value.path).toBe(ROUTE_PATHS.admin)
})

it('rechecks a forced-password session and keeps a failed read in status recovery', async () => {
  const loggedIn = { ...installed.data, isLoggedIn: true, privilege: 'admin' }
  const redirect = '/admin?tab=statistics#latest'
  getStatus.mockResolvedValueOnce({ data: { ...loggedIn, passwordChangeRequired: true } })
    .mockRejectedValueOnce(new Error('status network fixture'))
    .mockResolvedValue({ data: { ...loggedIn, passwordChangeRequired: false } })
  const { default: router } = await import('./router.js')
  const { useAuth } = await import('@/composables/useAuth.js')

  await router.push(redirect)
  expect(router.currentRoute.value).toMatchObject({ path: ROUTE_PATHS.changePassword, query: { redirect } })
  await router.replace(authPageTarget(ROUTE_PATHS.startup, redirect))
  expect(router.currentRoute.value).toMatchObject({ path: ROUTE_PATHS.startup, query: { redirect } })
  expect(getStatus).toHaveBeenCalledTimes(2)

  const auth = useAuth()
  const user = await auth.fetchAuth({ force: true })
  await router.replace(resolveAuthNavigation(router.currentRoute.value, user, false, auth.authCheckState.value))
  expect(router.currentRoute.value.fullPath).toBe(redirect)
  expect(getStatus).toHaveBeenCalledTimes(3)
})
