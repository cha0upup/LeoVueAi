import { useRoute, useRouter } from 'vue-router'

import { ROUTE_PATHS } from '@/constants/app.js'
import { safeLocalStorage } from '@/utils/browserStorage.js'

const LAST_WORKSPACE_ROUTE_KEY = 'leovue-last-workspace-route'
const LAST_ADMIN_ROUTE_KEY = 'leovue-last-admin-route'
const DEFAULT_ADMIN_ROUTE = `${ROUTE_PATHS.admin}?tab=users`

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

const normalizeStoredRoute = (value, fallback, basePath) => {
  return isSafeInternalRoute(value) && isRouteInSpace(value, basePath)
    ? value
    : fallback
}

export function useAppModeNavigation() {
  const router = useRouter()
  const route = useRoute()

  const rememberWorkspaceRoute = (value = route.fullPath) => {
    if (typeof value === 'string' && isRouteInSpace(value, ROUTE_PATHS.main)) {
      safeLocalStorage.setItem(LAST_WORKSPACE_ROUTE_KEY, value)
    }
  }

  const rememberAdminRoute = (value = route.fullPath) => {
    if (typeof value === 'string' && isRouteInSpace(value, ROUTE_PATHS.admin)) {
      safeLocalStorage.setItem(LAST_ADMIN_ROUTE_KEY, value)
    }
  }

  const getWorkspaceRoute = () => {
    return normalizeStoredRoute(
      safeLocalStorage.getItem(LAST_WORKSPACE_ROUTE_KEY),
      ROUTE_PATHS.main,
      ROUTE_PATHS.main
    )
  }

  const getAdminRoute = () => {
    return normalizeStoredRoute(
      safeLocalStorage.getItem(LAST_ADMIN_ROUTE_KEY),
      DEFAULT_ADMIN_ROUTE,
      ROUTE_PATHS.admin
    )
  }

  const goToAdmin = ({ tab } = {}) => {
    rememberWorkspaceRoute()
    if (tab) {
      return router.push({
        path: ROUTE_PATHS.admin,
        query: { tab }
      })
    }
    return router.push(getAdminRoute())
  }

  const goToWorkspace = () => {
    rememberAdminRoute()
    return router.push(getWorkspaceRoute())
  }

  return {
    goToAdmin,
    goToWorkspace,
    rememberAdminRoute,
    rememberWorkspaceRoute
  }
}
