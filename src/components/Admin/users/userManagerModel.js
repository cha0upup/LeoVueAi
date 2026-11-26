const BUILT_IN_ADMIN = 'admin'
// Team option values are strings, so numeric zero only means unassigned.
export const UNASSIGNED_TEAM = 0

const normalizeText = (value) => String(value ?? '').trim()
const normalizeIdentity = (value) => normalizeText(value).toLowerCase()

export function createUserForm() {
  return {
    userId: '',
    userName: '',
    password: '',
    confirmPassword: '',
    privilege: 'normal',
    teamId: '',
    status: 1
  }
}

export function createPasswordResetForm() {
  return {
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
  return [user.userId, user.userName]
    .some((value) => normalizeIdentity(value) === BUILT_IN_ADMIN)
}

export function buildDirectoryTeamNames(teams, users) {
  const names = new Map()
  for (const { teamId, teamName } of teams) {
    const id = normalizeText(teamId)
    if (id) names.set(id, normalizeText(teamName) || id)
  }
  for (const { teamId } of users ?? []) {
    const id = normalizeText(teamId)
    if (id && !names.has(id)) names.set(id, id)
  }
  return names
}

export function filterUsers(users, { keyword = '', role = '', team = '', status = '' } = {}, teamNames) {
  const list = Array.isArray(users) ? users : []
  const query = normalizeIdentity(keyword)
  const teamId = normalizeText(team)
  const filterStatus = status === 0 || status === 1

  return list.filter((user) => {
    if (role && normalizeText(user.privilege) !== normalizeText(role)) return false
    if (filterStatus && normalizeUserStatus(user.status) !== status) return false
    const userTeam = normalizeText(user.teamId)
    if (team === UNASSIGNED_TEAM) {
      if (userTeam) return false
    } else if (teamId && userTeam !== teamId) {
      return false
    }
    if (!query) return true

    const teamName = userTeam ? teamNames?.get(userTeam) : '未分配团队'
    return [user.userName, user.userId, user.privilege, getRoleDisplayName(user.privilege), userTeam, teamName]
      .some((value) => normalizeIdentity(value).includes(query))
  })
}

export function userStats(users) {
  const list = Array.isArray(users) ? users : []
  const totals = { total: list.length, admin: 0, leader: 0, normal: 0, assignedToTeam: 0 }
  for (const user of list) {
    if (user.privilege === 'admin') totals.admin++
    else if (user.privilege === 'leader') totals.leader++
    else if (user.privilege === 'normal') totals.normal++
    if (normalizeText(user.teamId)) totals.assignedToTeam++
  }
  return totals
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
    && normalizeText(user.teamId) === normalizeText(currentUser.teamId)
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
