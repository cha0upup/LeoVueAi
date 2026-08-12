import { ROUTE_PATHS } from '@/constants/app.js'

const isSafeLocalRedirect = (value) =>
  typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')

const getRequestedRedirect = (to) => {
  const queryRedirect = Array.isArray(to.query?.redirect)
    ? to.query.redirect[0]
    : to.query?.redirect
  const candidate = to.path === ROUTE_PATHS.login ? queryRedirect : to.fullPath

  if (!isSafeLocalRedirect(candidate)) return null
  if (candidate.startsWith(ROUTE_PATHS.login)) return null
  if (candidate.startsWith(ROUTE_PATHS.changePassword)) return null
  return candidate
}

const passwordChangeTarget = (to) => {
  const redirect = getRequestedRedirect(to)
  return redirect
    ? { path: ROUTE_PATHS.changePassword, query: { redirect } }
    : { path: ROUTE_PATHS.changePassword }
}

/**
 * 返回路由守卫应跳转到的位置；返回 null 表示允许当前导航。
 */
export function resolveAuthNavigation(to, currentUser) {
  if (to.path === ROUTE_PATHS.login) {
    if (!currentUser) return null
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
