import { useRoute, useRouter } from 'vue-router'

import { ROUTE_PATHS } from '@/constants/app.js'
import { safeLocalStorage } from '@/utils/browserStorage.js'
import { registerSessionCleanup } from '@/services/sessionLifecycle.js'

const LAST_ADMIN_ROUTE_KEY = 'leovue-last-admin-route'
const DEFAULT_ADMIN_ROUTE = `${ROUTE_PATHS.admin}?tab=users`

const unregister = registerSessionCleanup('app-navigation', () => {
  safeLocalStorage.removeItem(LAST_ADMIN_ROUTE_KEY)
})
if (import.meta.hot) import.meta.hot.dispose(unregister)

const isSafeInternalRoute = (value) => {
  return typeof value === 'string'
    && value.startsWith('/')
    && !value.startsWith('//')
    && !value.startsWith(ROUTE_PATHS.login)
}

const isRouteInSpace = (value, basePath) => {
  return value === basePath
    || value.startsWith(`${basePath}?`)
    || value.startsWith(`${basePath}#`)
    || value.startsWith(`${basePath}/`)
}

const readStoredRoute = (storageKey, basePath, fallback = basePath) => {
  const value = safeLocalStorage.getItem(storageKey)
  return isSafeInternalRoute(value) && isRouteInSpace(value, basePath)
    ? value
    : fallback
}

export function useAppModeNavigation() {
  const router = useRouter()
  const route = useRoute()

  const rememberAdminRoute = (value = route.fullPath) => {
    if (typeof value === 'string' && isRouteInSpace(value, ROUTE_PATHS.admin)) {
      safeLocalStorage.setItem(LAST_ADMIN_ROUTE_KEY, value)
    }
  }

  const goToAdmin = ({ tab } = {}) => {
    if (tab) {
      return router.push({
        path: ROUTE_PATHS.admin,
        query: { tab }
      })
    }
    return router.push(readStoredRoute(LAST_ADMIN_ROUTE_KEY, ROUTE_PATHS.admin, DEFAULT_ADMIN_ROUTE))
  }

  return {
    goToAdmin,
    rememberAdminRoute
  }
}
