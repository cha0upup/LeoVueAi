/**
 * 当前登录用户身份信息组合式函数。
 *
 * 使用方式：
 *   const { currentUser, isAdmin, isLeader, isNormal, fetchAuth } = useAuth()
 *
 * currentUser 在首次调用 fetchAuth() 后填充。
 * AdminConsole / UserManager / TeamManager 均可注入此函数以做权限守卫。
 */
import { ref, computed } from 'vue'
import { getLoginStatusApi } from '@/services/api/auth.js'

const currentUser = ref(null)
const authLoading = ref(false)
const authFetched = ref(false)
let authInflight = null

/**
 * 从后端 /platform/user/status 拉取当前会话用户信息。
 * 已登录时填充 currentUser，未登录时置 null。
 */
async function fetchAuth({ force = false } = {}) {
  if (authInflight) return authInflight
  if (authFetched.value && !force) return currentUser.value

  authLoading.value = true
  authInflight = (async () => {
    try {
      const res = await getLoginStatusApi()
      const data = res?.data
      if (data?.isLoggedIn) {
        currentUser.value = data
      } else {
        currentUser.value = null
      }
    } catch {
      currentUser.value = null
    } finally {
      authFetched.value = true
      authLoading.value = false
      authInflight = null
    }
    return currentUser.value
  })()
  return authInflight
}

function resetAuth() {
  currentUser.value = null
  authLoading.value = false
  authFetched.value = false
  authInflight = null
}

export function useAuth() {
  const isAdmin = computed(() => currentUser.value?.privilege === 'admin')
  const isLeader = computed(() => currentUser.value?.privilege === 'leader')
  const isNormal = computed(() => currentUser.value?.privilege === 'normal')

  return {
    currentUser,
    isAdmin,
    isLeader,
    isNormal,
    authLoading,
    authFetched,
    fetchAuth,
    resetAuth
  }
}
