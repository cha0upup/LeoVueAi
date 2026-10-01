import { ROUTE_PATHS } from '@/constants/app.js'
import { normalizeHttpError } from './httpError.js'
import {
  createSessionChangedError,
  isCurrentSession,
  resetSessionState,
  sessionGeneration
} from './sessionLifecycle.js'

let navigation = {
  getCurrentRoute: () => null,
  replaceRoute: null
}

export function configureHttpErrorHandling(handlers = {}) {
  navigation = { ...navigation, ...handlers }
}

function resolveRedirect(code, payload) {
  if (code === 403) {
    return payload?.data?.passwordChangeRequired === true
      ? ROUTE_PATHS.changePassword
      : ROUTE_PATHS.main
  }
  if (code !== 401) return null

  const route = navigation.getCurrentRoute?.()
  return route?.fullPath && route.path !== ROUTE_PATHS.login
    ? { path: ROUTE_PATHS.login, query: { redirect: route.fullPath } }
    : ROUTE_PATHS.login
}

// Both Axios and fetch use the same identity transition and error contract.
export function handleHttpError(error, requestGeneration = sessionGeneration.value) {
  if (!isCurrentSession(requestGeneration)) return createSessionChangedError()

  const { code } = normalizeHttpError(error)
  const target = resolveRedirect(code, error?.response?.data)
  if (code === 401) resetSessionState()
  const targetPath = typeof target === 'string' ? target : target?.path
  if (targetPath && navigation.getCurrentRoute?.()?.path !== targetPath && navigation.replaceRoute) {
    Promise.resolve(navigation.replaceRoute(target)).catch(() => {
      // Another request may already have completed the same navigation.
    })
  }
  return error
}
