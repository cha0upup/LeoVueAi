import { createRouter, createWebHistory } from 'vue-router'
import { ROUTE_NAMES, ROUTE_PATHS } from '@/constants/app.js'
import { useAuth } from '@/composables/useAuth.js'
import { resolveAuthNavigation } from '@/routerGuards.js'
import { configureHttpErrorHandling } from '@/services/http.js'
import Startup from '@/views/StartupCheckView.vue'

// 路由按需加载，减小首屏包体积
const Main = () => import('@/views/MainView.vue')
const Login = () => import('@/views/LoginView.vue')
const Setup = () => import('@/views/SetupView.vue')
const ChangePassword = () => import('@/views/ChangePasswordView.vue')
const AdminConsole = () => import('@/views/AdminView.vue')

const routes = [
  {
    path: ROUTE_PATHS.root,
    redirect: ROUTE_PATHS.login
  },
  {
    path: ROUTE_PATHS.main,
    name: ROUTE_NAMES.main,
    component: Main,
    meta: { requiresAuth: true }
  },
  {
    path: ROUTE_PATHS.mainAgent,
    name: ROUTE_NAMES.mainAgent,
    component: Main,
    meta: { requiresAuth: true }
  },
  {
    path: ROUTE_PATHS.login,
    name: ROUTE_NAMES.login,
    component: Login
  },
  {
    path: ROUTE_PATHS.startup,
    name: ROUTE_NAMES.startup,
    component: Startup,
    meta: { showAppHeader: false }
  },
  {
    path: ROUTE_PATHS.setup,
    name: ROUTE_NAMES.setup,
    component: Setup,
    meta: { showAppHeader: false }
  },
  {
    path: ROUTE_PATHS.changePassword,
    name: ROUTE_NAMES.changePassword,
    component: ChangePassword,
    meta: { requiresAuth: true, showAppHeader: false }
  },
  {
    path: ROUTE_PATHS.admin,
    name: ROUTE_NAMES.admin,
    component: AdminConsole,
    meta: { requiresAuth: true, requiresManager: true }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: ROUTE_PATHS.login
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

configureHttpErrorHandling({
  getCurrentRoute: () => router.currentRoute.value,
  replaceRoute: target => router.replace(target)
})

/**
 * 全局前置守卫：未登录时拦截受保护路由，避免页面闪烁。
 * 登录状态通过 /platform/user/status 接口判断，结果缓存在 useAuth composable 中。
 */
router.beforeEach(async (to, from, next) => {
  const { currentUser, authFetched, authCheckState, initializationRequired, fetchAuth } = useAuth()

  if (![ROUTE_PATHS.login, ROUTE_PATHS.setup, ROUTE_PATHS.startup].includes(to.path) && !to.meta.requiresAuth) {
    return next()
  }

  const showingError = to.path === ROUTE_PATHS.startup && authCheckState.value === 'error'
  if (!showingError && (!authFetched.value || initializationRequired.value || to.path === ROUTE_PATHS.setup)) {
    await fetchAuth({ force: true })
  }

  const redirect = resolveAuthNavigation(to, currentUser.value, initializationRequired.value, authCheckState.value)
  return redirect ? next(redirect) : next()
})

export default router
