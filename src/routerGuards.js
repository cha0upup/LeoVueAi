import { ROUTE_PATHS } from '@/constants/app.js'

export function normalizeAuthRedirect(value) {
  const candidate = Array.isArray(value) ? value[0] : value
  if (typeof candidate !== 'string' || !candidate.startsWith('/') || candidate.startsWith('//')) return null
  if ([ROUTE_PATHS.login, ROUTE_PATHS.changePassword, ROUTE_PATHS.setup, ROUTE_PATHS.startup]
    .some(path => candidate.startsWith(path))) return null
  return candidate
}

const getRequestedRedirect = (to) => normalizeAuthRedirect(
  [ROUTE_PATHS.login, ROUTE_PATHS.startup].includes(to.path) ? to.query?.redirect : to.fullPath
)

const passwordChangeTarget = (to) => {
  const redirect = getRequestedRedirect(to)
  return redirect
    ? { path: ROUTE_PATHS.changePassword, query: { redirect } }
    : { path: ROUTE_PATHS.changePassword }
}

/**
 * 返回路由守卫应跳转到的位置；返回 null 表示允许当前导航。
 */
export function resolveAuthNavigation(to, currentUser, initializationRequired = false, checkState = 'ready') {
  if (!['ready', 'required'].includes(checkState)) {
    if (to.path === ROUTE_PATHS.startup) return null
    const redirect = getRequestedRedirect(to)
    return { path: ROUTE_PATHS.startup, ...(redirect ? { query: { redirect } } : {}) }
  }
  if (initializationRequired) {
    return to.path === ROUTE_PATHS.setup ? null : { path: ROUTE_PATHS.setup }
  }
  if (to.path === ROUTE_PATHS.startup) {
    if (currentUser?.passwordChangeRequired) return passwordChangeTarget(to)
    const redirect = getRequestedRedirect(to)
    return currentUser ? { path: redirect || ROUTE_PATHS.main }
      : { path: ROUTE_PATHS.login, ...(redirect ? { query: { redirect } } : {}) }
  }
  if (to.path === ROUTE_PATHS.login || to.path === ROUTE_PATHS.setup) {
    if (!currentUser) return to.path === ROUTE_PATHS.setup ? { path: ROUTE_PATHS.login } : null
    if (currentUser.passwordChangeRequired) return passwordChangeTarget(to)
    return { path: ROUTE_PATHS.main }
  }

  if (!to.meta?.requiresAuth) return null

  if (!currentUser) {
    return {
      path: ROUTE_PATHS.login,
      query: { redirect: to.fullPath }
    }
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
