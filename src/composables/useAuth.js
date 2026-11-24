/**
 * 当前登录用户身份信息组合式函数。
 *
 * 使用方式：
 *   const { currentUser, isAdmin, isLeader, fetchAuth } = useAuth()
 *
 * currentUser 在首次调用 fetchAuth() 后填充。
 * AdminConsole / UserManager / TeamManager 均可注入此函数以做权限守卫。
 */
import { ref, computed } from 'vue'
import { getLoginStatusApi } from '@/services/api/auth.js'
import { isCurrentSession, registerSessionCleanup, resetSessionState, sessionGeneration } from '@/services/sessionLifecycle.js'

const currentUser = ref(null)
const authLoading = ref(false)
const authFetched = ref(false)
const authCheckState = ref('unknown')
const authError = ref('')
const startupRetryDelay = ref(null)
const initializationRequired = ref(false)
const passwordMinLength = ref(8)
const passwordMaxLength = ref(256)
let authInflight = null

function readStartupRetryDelay(error) {
  const { status, headers } = error?.response ?? {}
  if (status !== 503) return null
  const hint = headers?.get?.('Retry-After') ?? headers?.['retry-after']
  // 当前后端返回秒数；异常提示仅保留手动重试，避免紧密轮询或长期等待。
  if (!/^\d{1,2}$/.test(String(hint ?? ''))) return null
  const seconds = Number(hint)
  return seconds >= 1 && seconds <= 30 ? seconds * 1000 : null
}

/**
 * 从后端 /platform/user/status 拉取当前会话用户信息。
 * 已登录时填充 currentUser，未登录时置 null。
 */
async function fetchAuth({ force = false } = {}) {
  if (authInflight) return authInflight
  if (authFetched.value && !force) return currentUser.value

  authLoading.value = true
  authCheckState.value = 'checking'
  authError.value = ''
  startupRetryDelay.value = null
  const requestGeneration = sessionGeneration.value
  authInflight = (async () => {
    try {
      const res = await getLoginStatusApi()
      const data = res?.data
      if (!isCurrentSession(requestGeneration)) return null
      if (typeof data?.isLoggedIn !== 'boolean') throw new Error('系统状态响应格式异常')
      currentUser.value = data?.isLoggedIn ? data : null
      initializationRequired.value = data?.initializationRequired === true
      passwordMinLength.value = data?.passwordMinLength || 8
      passwordMaxLength.value = data?.passwordMaxLength || 256
      authFetched.value = true
      authCheckState.value = initializationRequired.value ? 'required' : 'ready'
    } catch (error) {
      if (isCurrentSession(requestGeneration)) {
        currentUser.value = null
        authFetched.value = false
        authCheckState.value = 'error'
        authError.value = error?.response?.data?.msg || error?.message || '系统状态检查失败，请重试'
        startupRetryDelay.value = readStartupRetryDelay(error)
      }
    } finally {
      if (isCurrentSession(requestGeneration)) {
        authLoading.value = false
        authInflight = null
      }
    }
    return isCurrentSession(requestGeneration) ? currentUser.value : null
  })()
  return authInflight
}

const unregister = registerSessionCleanup('auth', () => {
  currentUser.value = null
  authLoading.value = false
  authFetched.value = false
  authCheckState.value = 'unknown'
  authError.value = ''
  startupRetryDelay.value = null
  authInflight = null
  initializationRequired.value = false
  passwordMinLength.value = 8
  passwordMaxLength.value = 256
})
if (import.meta.hot) import.meta.hot.dispose(unregister)

export function useAuth() {
  const isAdmin = computed(() => currentUser.value?.privilege === 'admin')
  const isLeader = computed(() => currentUser.value?.privilege === 'leader')

  return {
    currentUser,
    isAdmin,
    isLeader,
    authLoading,
    authFetched,
    authCheckState,
    authError,
    startupRetryDelay,
    initializationRequired,
    passwordMinLength,
    passwordMaxLength,
    fetchAuth,
    resetAuth: resetSessionState
  }
}
