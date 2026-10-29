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
  it.each(['unknown', 'checking', 'error'])('keeps %s status out of login/setup and protected views', state => {
    expect(resolveAuthNavigation(route(ROUTE_PATHS.admin), null, false, state)).toEqual({
      path: ROUTE_PATHS.startup, query: { redirect: ROUTE_PATHS.admin }
    })
    expect(resolveAuthNavigation(route(ROUTE_PATHS.startup), null, false, state)).toBeNull()
  })

  it('continues to setup or login after a successful status retry', () => {
    const startup = route(ROUTE_PATHS.startup, { query: { redirect: ROUTE_PATHS.admin }, meta: {} })
    expect(resolveAuthNavigation(startup, null, true, 'required')).toEqual({ path: ROUTE_PATHS.setup })
    expect(resolveAuthNavigation(startup, null, false, 'ready')).toEqual({
      path: ROUTE_PATHS.login, query: { redirect: ROUTE_PATHS.admin }
    })
    expect(resolveAuthNavigation(startup, { privilege: 'admin' }, false, 'ready')).toEqual({ path: ROUTE_PATHS.admin })
  })

  it.each([ROUTE_PATHS.login, ROUTE_PATHS.main, ROUTE_PATHS.admin, ROUTE_PATHS.changePassword])(
    'sends %s to the setup wizard on a fresh deployment', path => {
      expect(resolveAuthNavigation(route(path), null, true)).toEqual({ path: ROUTE_PATHS.setup })
    }
  )

  it('allows setup only while initialization is required', () => {
    expect(resolveAuthNavigation(route(ROUTE_PATHS.setup, { meta: {} }), null, true)).toBeNull()
    expect(resolveAuthNavigation(route(ROUTE_PATHS.setup, { meta: {} }), null, false))
      .toEqual({ path: ROUTE_PATHS.login })
    expect(resolveAuthNavigation(route(ROUTE_PATHS.setup, { meta: {} }), { privilege: 'admin' }, false))
      .toEqual({ path: ROUTE_PATHS.main })
  })

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
