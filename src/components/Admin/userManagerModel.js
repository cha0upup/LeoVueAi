const BUILT_IN_ADMIN = 'admin'

const normalizeText = (value) => String(value ?? '').trim()
const normalizeIdentity = (value) => normalizeText(value).toLowerCase()

export function createUserForm() {
  return {
    id: '',
    username: '',
    password: '',
    confirmPassword: '',
    privilege: 'normal',
    teamname: '',
    status: 1
  }
}

export function createPasswordResetForm() {
  return {
    userId: '',
    newPassword: '',
    confirmPassword: ''
  }
}

export function normalizeUserStatus(status) {
  return status === 0 ? 0 : 1
}

export const isUserEnabled = (status) => normalizeUserStatus(status) === 1

export const formatUserStatus = (status) => (isUserEnabled(status) ? '启用' : '禁用')

export function isBuiltInAdmin(user) {
  if (!user) return false
  return [user.id, user.username]
    .some((value) => normalizeIdentity(value) === BUILT_IN_ADMIN)
}

export function normalizeUserRecord(user = {}) {
  return {
    ...user,
    id: user.userId,
    username: user.userName,
    privilege: user.privilege || 'normal',
    teamname: user.teamId || '',
    status: normalizeUserStatus(user.status),
    email: user.email || '',
    phone: user.phone || '',
    lastLoginTime: user.lastLoginTime || '',
    loginCount: user.loginCount || 0,
    remark: user.remark || '',
    updateTime: user.updateTime || '',
    createTime: user.createTime
  }
}

export function normalizeTeamRecord(team = {}) {
  return {
    ...team,
    id: team.teamId,
    teamname: team.teamName
  }
}

export function filterUsers(users, { keyword = '', role = '', team = '' } = {}) {
  const list = Array.isArray(users) ? users : []
  const query = normalizeIdentity(keyword)

  return list.filter((user) => {
    if (query) {
      const matchesQuery = [
        user.username,
        user.id,
        user.privilege
      ].some((value) => normalizeIdentity(value).includes(query))
      if (!matchesQuery) return false
    }

    if (role && normalizeText(user.privilege) !== normalizeText(role)) return false
    if (team) {
      const matchesTeam = normalizeText(user.teamname) === normalizeText(team)
      if (!matchesTeam) return false
    }
    return true
  })
}

export function userStats(users) {
  const list = Array.isArray(users) ? users : []
  return {
    total: list.length,
    admin: list.filter((user) => user.privilege === 'admin').length,
    leader: list.filter((user) => user.privilege === 'leader').length,
    normal: list.filter((user) => user.privilege === 'normal').length,
    assignedToTeam: list.filter((user) => user.teamname).length
  }
}

export function getRoleTagType(privilege) {
  if (privilege === 'admin') return 'danger'
  if (privilege === 'leader') return 'warning'
  return 'primary'
}

export function getRoleDisplayName(privilege) {
  if (privilege === 'admin') return '管理员'
  if (privilege === 'leader') return '队长'
  return '普通用户'
}

export function canManageUser(user, { isAdmin = false, isLeader = false, currentUser } = {}) {
  if (!user) return false
  if (isAdmin) return true
  if (!isLeader || !currentUser?.teamId) return false
  return user.privilege === 'normal'
    && normalizeText(user.teamname) === normalizeText(currentUser.teamId)
}

export function canEditUser(user, actor) {
  return canManageUser(user, actor) && !isBuiltInAdmin(user)
}

export function getManageDisabledReason(user, actor) {
  if (canManageUser(user, actor)) return ''
  if (actor?.isLeader) return '队长只能管理本团队普通用户'
  return '无权管理用户'
}

export function getEditDisabledReason(user, actor) {
  if (isBuiltInAdmin(user)) return '系统内置 admin 禁止编辑'
  return getManageDisabledReason(user, actor)
}
