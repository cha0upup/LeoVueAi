import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ROUTE_PATHS } from '@/constants/app.js'
import { useAppModeNavigation } from './useAppModeNavigation.js'

const { route, push, values } = vi.hoisted(() => ({ route: { fullPath: '' }, push: vi.fn(), values: new Map() }))
vi.mock('vue-router', () => ({ useRoute: () => route, useRouter: () => ({ push }) }))
vi.mock('@/utils/browserStorage.js', () => ({ safeLocalStorage: {
  getItem: key => values.get(key), setItem: (key, value) => values.set(key, value),
  removeItem: key => values.delete(key)
} }))

describe('admin mode navigation', () => {
  beforeEach(() => {
    push.mockClear()
    values.clear()
    route.fullPath = ROUTE_PATHS.main
  })

  it('remembers only admin destinations and restores them from workspace', () => {
    const navigation = useAppModeNavigation()
    route.fullPath = `${ROUTE_PATHS.admin}?tab=system`
    navigation.rememberAdminRoute()
    route.fullPath = ROUTE_PATHS.main
    navigation.rememberAdminRoute()
    navigation.goToAdmin()
    expect(push).toHaveBeenCalledWith(`${ROUTE_PATHS.admin}?tab=system`)
    expect(values.size).toBe(1)
    expect(Object.keys(navigation)).toEqual(['goToAdmin', 'rememberAdminRoute'])
  })

  it.each(['//example.invalid', '/login', '/workspace', '/admin-other'])('rejects an unrelated stored destination: %s', destination => {
    values.set('leovue-last-admin-route', destination)
    useAppModeNavigation().goToAdmin()
    expect(push).toHaveBeenCalledWith(`${ROUTE_PATHS.admin}?tab=users`)
  })

  it('uses explicit configuration tabs without creating workspace route storage', () => {
    useAppModeNavigation().goToAdmin({ tab: 'system' })
    expect(push).toHaveBeenCalledWith({ path: ROUTE_PATHS.admin, query: { tab: 'system' } })
    expect(values.size).toBe(0)
  })
})
