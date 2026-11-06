import { describe, expect, it } from 'vitest'

import {
  canEditUser,
  canManageUser,
  createUserForm,
  filterUsers,
  getEditDisabledReason,
  isBuiltInAdmin,
  normalizeUserStatus,
  userStats
} from './userManagerModel.js'

describe('userManagerModel', () => {
  it('uses canonical user records directly', () => {
    expect(normalizeUserStatus(0)).toBe(0)
    expect(normalizeUserStatus(1)).toBe(1)
    expect(normalizeUserStatus(undefined)).toBe(1)
    expect(createUserForm()).toMatchObject({ userId: '', userName: '', teamId: '' })
  })

  it('filters safely when identifiers are numeric', () => {
    const users = [
      { userId: 42, userName: 'Alice', privilege: 'normal', teamId: 'team-a' },
      { userId: 7, userName: 'Bob', privilege: 'leader', teamId: 'team-b' }
    ]

    expect(filterUsers(users, { keyword: '42' })).toEqual([users[0]])
    expect(filterUsers(users, { role: 'leader', team: 'team-b' })).toEqual([users[1]])
  })

  it('keeps built-in admin immutable through edit controls', () => {
    const builtIn = { userId: 'ADMIN', userName: 'renamed', privilege: 'admin' }
    const actor = { isAdmin: true, currentUser: { privilege: 'admin' } }

    expect(isBuiltInAdmin(builtIn)).toBe(true)
    expect(canManageUser(builtIn, actor)).toBe(true)
    expect(canEditUser(builtIn, actor)).toBe(false)
    expect(getEditDisabledReason(builtIn, actor)).toContain('禁止编辑')
  })

  it('limits leaders to normal users in their own team', () => {
    const actor = { isLeader: true, currentUser: { teamId: 'team-a' } }

    expect(canManageUser({ privilege: 'normal', teamId: 'team-a' }, actor)).toBe(true)
    expect(canManageUser({ privilege: 'leader', teamId: 'team-a' }, actor)).toBe(false)
    expect(canManageUser({ privilege: 'normal', teamId: 'team-b' }, actor)).toBe(false)
  })

  it('derives role and team statistics from normalized users', () => {
    expect(userStats([
      { privilege: 'admin', teamId: 'adminteam' },
      { privilege: 'leader', teamId: 'team-a' },
      { privilege: 'normal' }
    ])).toEqual({ total: 3, admin: 1, leader: 1, normal: 1, assignedToTeam: 2 })
  })
})
