import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { deferred } from '@/test-support/deferred.js'
import { getAuditLogSummaryPageApi } from '@/services/api/admin.js'
import { useAuditLogPage } from './useAuditLogPage.js'

vi.mock('@/services/api/admin.js', () => ({ getAuditLogSummaryPageApi: vi.fn() }))

const pageResponse = (total, logs = [], successCount = 0, failedCount = 0) => ({
  data: { logs, total, successCount, failedCount }
})

let scope
let listing
beforeEach(() => {
  getAuditLogSummaryPageApi.mockReset()
  scope = effectScope()
  listing = scope.run(useAuditLogPage)
})
afterEach(() => scope.stop())

it('uses one request per page, with the submitted filters and returned counts', async () => {
  const original = { status: 'FAILED' }
  getAuditLogSummaryPageApi.mockResolvedValue(pageResponse(30, [{ logId: 'a' }], 0, 30))
  await listing.applyFilters(original)
  original.status = 'SUCCESS'
  await listing.changePage(2)
  await listing.changePage(2)
  await listing.changePageSize(50)

  expect(getAuditLogSummaryPageApi.mock.calls.map(([params]) => params)).toEqual([
    { status: 'FAILED', limit: 20, offset: 0 },
    { status: 'FAILED', limit: 20, offset: 20 },
    { status: 'FAILED', limit: 50, offset: 0 }
  ])
  expect(listing.page.value).toMatchObject({ total: 30, failedCount: 30 })
  expect(listing.updatedAt.value).toBeInstanceOf(Date)
})

it('aborts superseded requests and ignores stale results and errors', async () => {
  const first = deferred()
  const second = deferred()
  getAuditLogSummaryPageApi.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
  const older = listing.applyFilters({ userId: 'old' })
  const latest = listing.applyFilters({ userId: 'new' })
  expect(getAuditLogSummaryPageApi.mock.calls[0][1].signal.aborted).toBe(true)
  first.reject(new Error('stale error'))
  await older
  expect(listing.loading.value).toBe(true)
  expect(listing.errorMessage.value).toBe('')
  second.resolve(pageResponse(1, [{ logId: 'new' }], 1))
  await latest
  expect(listing.page.value.logs).toEqual([{ logId: 'new' }])
  expect(listing.loading.value).toBe(false)

  getAuditLogSummaryPageApi.mockReturnValueOnce(first.promise.catch(() => pageResponse(999)))
  const closing = listing.loadPage()
  scope.stop()
  expect(getAuditLogSummaryPageApi.mock.calls.at(-1)[1].signal.aborted).toBe(true)
  await closing
  expect(listing.page.value.total).toBe(1)
})

it.each([0, 3])('returns to page one if the page disappeared (%d remaining)', async (total) => {
  getAuditLogSummaryPageApi
    .mockResolvedValueOnce(pageResponse(25, [{ logId: 'old' }]))
    .mockResolvedValueOnce(pageResponse(total))
    .mockResolvedValueOnce(pageResponse(total, [{ logId: 'last' }]))
  await listing.loadPage()
  await listing.changePage(2)
  expect(listing.currentPage.value).toBe(1)
  expect(getAuditLogSummaryPageApi.mock.calls.map(([params]) => params.offset))
    .toEqual(total > 0 ? [0, 20, 0] : [0, 20])
  expect(listing.page.value.total).toBe(total)
})

it('clears stale counts on failure and supports retrying the same filters', async () => {
  getAuditLogSummaryPageApi
    .mockResolvedValueOnce(pageResponse(3))
    .mockResolvedValueOnce({ data: { logs: [], total: 5 } })
    .mockResolvedValueOnce(pageResponse(4))
  await listing.applyFilters({ userId: 'user' })
  await listing.loadPage()
  expect(listing.errorMessage.value).toContain('审计日志响应不完整')
  expect(listing.page.value).toBeNull()
  expect(listing.updatedAt.value).toBeNull()
  await listing.loadPage()
  expect(getAuditLogSummaryPageApi.mock.calls[2][0].userId).toBe('user')
  expect(listing.errorMessage.value).toBe('')
  expect(listing.page.value.total).toBe(4)
})
