import { expect, it, vi } from 'vitest'
import http from '../http.js'
import { getAuditLogDetailApi, getAuditLogSummaryPageApi, getEnabledUserOptionsApi, getTeamLeaderOptionsApi } from './admin.js'

vi.mock('../http.js', () => ({ default: { get: vi.fn() } }))

it('requests an audit summary page with its filters and offset', () => {
  const { signal } = new AbortController()
  getAuditLogSummaryPageApi({ limit: 20, offset: 40, userId: 'user' }, { signal })
  expect(http.get).toHaveBeenLastCalledWith('/platform/admin/audit-logs', {
    params: { limit: 20, offset: 40, userId: 'user' },
    signal
  })
})

it('requests the complete audit detail only by log id', () => {
  const { signal } = new AbortController()
  getAuditLogDetailApi('id', { signal })
  expect(http.get).toHaveBeenLastCalledWith('/platform/admin/audit-logs/detail', {
    params: { logId: 'id' },
    signal
  })
})

it('requests only the identity fields for leader candidates', () => {
  const { signal } = new AbortController()
  getTeamLeaderOptionsApi({ signal })
  expect(http.get).toHaveBeenLastCalledWith('/platform/admin/users/no-team', { signal })
})

it('requests the enabled account picker instead of full user profiles', () => {
  const { signal } = new AbortController()
  getEnabledUserOptionsApi({ signal })
  expect(http.get).toHaveBeenLastCalledWith('/platform/admin/users/enabled-options', { signal })
})
