import { createRouter, createWebHistory } from 'vue-router'
import { ROUTE_NAMES, ROUTE_PATHS } from '@/constants/app.js'
import { useAuth } from '@/composables/useAuth.js'
import { resolveAuthNavigation } from '@/routerGuards.js'
import { installChunkLoadRecovery } from '@/utils/chunkLoadRecovery.js'

// 路由按需加载，减小首屏包体积
const Main = () => import('@/views/MainView.vue')
const Login = () => import('@/views/LoginView.vue')
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
    path: ROUTE_PATHS.mainPuppet,
    name: ROUTE_NAMES.mainPuppet,
    component: Main,
    meta: { requiresAuth: true }
  },
  {
    path: ROUTE_PATHS.login,
    name: ROUTE_NAMES.login,
    component: Login
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

/**
 * 全局前置守卫：未登录时拦截受保护路由，避免页面闪烁。
 * 登录状态通过 /platform/user/status 接口判断，结果缓存在 useAuth composable 中。
 */
router.beforeEach(async (to, from, next) => {
  const { currentUser, authFetched, fetchAuth } = useAuth()

  if (to.path !== ROUTE_PATHS.login && !to.meta.requiresAuth) {
    return next()
  }

  if (!authFetched.value) {
    await fetchAuth()
  }

  const redirect = resolveAuthNavigation(to, currentUser.value)
  return redirect ? next(redirect) : next()
})

installChunkLoadRecovery(router)

export default router
