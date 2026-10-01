import { computed } from 'vue'

import { DEFAULT_USERNAME, ROUTE_PATHS } from '@/constants/app.js'
import { logoutApi } from '@/services/api/auth.js'
import { useAuth } from '@/composables/useAuth.js'
import { confirmAction } from '@/utils/confirmUtils.js'
import { icons } from '@/utils/icons.js'
import { showError, showSuccess } from '@/utils/messageUtils.js'
import { isCurrentSession, sessionGeneration } from '@/services/sessionLifecycle.js'

const ROLE_LABELS = {
  admin: '管理员',
  leader: '队长',
  normal: '普通用户'
}

export function useUserMenuActions({
  afterLogout,
  profileDialog,
  changePasswordDialog,
  router
} = {}) {
  const { currentUser, resetAuth } = useAuth()

  const username = computed(() => currentUser.value?.userName || DEFAULT_USERNAME)
  const userRoleLabel = computed(() => {
    if (!currentUser.value) return '当前用户'
    return ROLE_LABELS[currentUser.value.privilege] || '当前用户'
  })
  const userMenuItems = computed(() => {
    const items = [
      {
        command: 'profile',
        label: '个人信息',
        icon: icons.user
      }
    ]

    items.push(
      {
        command: 'changePassword',
        label: '修改密码',
        icon: icons.key
      },
      {
        command: 'logout',
        label: '退出登录',
        icon: icons.switchButton,
        divided: true
      }
    )

    return items
  })

  const handleLogout = async () => {
    const requestGeneration = sessionGeneration.value
    const confirmed = await confirmAction({
      title: '确认退出',
      message: '确定要退出登录吗？',
      type: 'warning'
    })

    if (!confirmed || !isCurrentSession(requestGeneration)) return

    try {
      await logoutApi()
      if (!isCurrentSession(requestGeneration)) return
      resetAuth()
      afterLogout?.()
      showSuccess('已退出登录')
      router?.push(ROUTE_PATHS.login)
    } catch {
      showError('退出登录失败')
    }
  }

  const handleCommand = async (command) => {
    switch (command) {
      case 'logout':
        await handleLogout()
        break
      case 'changePassword':
        changePasswordDialog?.value?.openChangePasswordDialog()
        break
      case 'profile':
        await profileDialog?.value?.openProfileDialog()
        break
      default:
        break
    }
  }

  return {
    handleCommand,
    handleLogout,
    userMenuItems,
    username,
    userRoleLabel
  }
}
