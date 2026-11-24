import { ROUTE_PATHS } from '@/constants/app.js'

const AUTH_PAGES = [ROUTE_PATHS.login, ROUTE_PATHS.changePassword, ROUTE_PATHS.setup, ROUTE_PATHS.startup]

export function normalizeAuthRedirect(value) {
  const candidate = Array.isArray(value) ? value[0] : value
  if (typeof candidate !== 'string' || !candidate.startsWith('/') || candidate.startsWith('//')) return null
  if (candidate.startsWith('/\\') || AUTH_PAGES.some(path => candidate.startsWith(path))) return null
  return candidate
}

export function authPageTarget(path, requested) {
  const redirect = normalizeAuthRedirect(requested)
  return redirect ? { path, query: { redirect } } : { path }
}

const getRequestedRedirect = (to) => AUTH_PAGES.includes(to.path) ? to.query?.redirect : to.fullPath
const passwordChangeTarget = (to) => authPageTarget(ROUTE_PATHS.changePassword, getRequestedRedirect(to))

/**
 * 返回路由守卫应跳转到的位置；返回 null 表示允许当前导航。
 */
export function resolveAuthNavigation(to, currentUser, initializationRequired = false, checkState = 'ready') {
  if (!['ready', 'required'].includes(checkState)) {
    if (to.path === ROUTE_PATHS.startup) return null
    return authPageTarget(ROUTE_PATHS.startup, getRequestedRedirect(to))
  }
  if (initializationRequired) {
    return to.path === ROUTE_PATHS.setup ? null : authPageTarget(ROUTE_PATHS.setup, getRequestedRedirect(to))
  }
  if ([ROUTE_PATHS.startup, ROUTE_PATHS.login, ROUTE_PATHS.setup].includes(to.path)) {
    if (!currentUser) {
      return to.path === ROUTE_PATHS.login ? null : authPageTarget(ROUTE_PATHS.login, getRequestedRedirect(to))
    }
    if (currentUser.passwordChangeRequired) return passwordChangeTarget(to)
    return normalizeAuthRedirect(getRequestedRedirect(to)) || { path: ROUTE_PATHS.main }
  }

  if (!to.meta?.requiresAuth) return null

  if (!currentUser) {
    return authPageTarget(ROUTE_PATHS.login, to.fullPath)
  }

  if (currentUser.passwordChangeRequired) {
    return to.path === ROUTE_PATHS.changePassword ? null : passwordChangeTarget(to)
  }

  if (to.path === ROUTE_PATHS.changePassword) {
    return { path: ROUTE_PATHS.main }
  }

  if (to.meta.requiresManager && !['admin', 'leader'].includes(currentUser.privilege)) {
    return { path: ROUTE_PATHS.main }
  }

  return null
}
