import { describe, expect, it } from 'vitest'

import { ROUTE_PATHS } from '@/constants/app.js'
import { resolveAuthNavigation } from './routerGuards.js'

const route = (path, options = {}) => ({
  path,
  fullPath: options.fullPath || path,
  query: options.query || {},
  meta: options.meta || { requiresAuth: true }
})

describe('authentication route guard', () => {
  it('sends a first-login session to the forced password page', () => {
    expect(resolveAuthNavigation(
      route(ROUTE_PATHS.main),
      { privilege: 'admin', passwordChangeRequired: true }
    )).toEqual({
      path: ROUTE_PATHS.changePassword,
      query: { redirect: ROUTE_PATHS.main }
    })
  })

  it('allows only the password page while a password change is required', () => {
    expect(resolveAuthNavigation(
      route(ROUTE_PATHS.changePassword),
      { privilege: 'admin', passwordChangeRequired: true }
    )).toBeNull()
  })

  it('preserves a safe requested route when login discovers a forced change', () => {
    expect(resolveAuthNavigation(
      route(ROUTE_PATHS.login, {
        query: { redirect: '/admin?tab=users' },
        meta: {}
      }),
      { privilege: 'admin', passwordChangeRequired: true }
    )).toEqual({
      path: ROUTE_PATHS.changePassword,
      query: { redirect: '/admin?tab=users' }
    })
  })

  it('keeps users whose password is already updated away from the forced page', () => {
    expect(resolveAuthNavigation(
      route(ROUTE_PATHS.changePassword),
      { privilege: 'admin', passwordChangeRequired: false }
    )).toEqual({ path: ROUTE_PATHS.main })
  })
})
