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

it('commits pagination only when loading succeeds and clears old results for a new filter', async () => {
  getAuditLogSummaryPageApi
    .mockResolvedValueOnce(pageResponse(45, [{ logId: 'first' }]))
    .mockResolvedValueOnce({ data: { logs: [], total: 45 } })
    .mockResolvedValueOnce(pageResponse(45, [{ logId: 'second' }]))
    .mockRejectedValueOnce(new Error('切换每页条数失败'))
    .mockRejectedValueOnce(new Error('查询失败'))
  await listing.applyFilters({ userId: 'user' })
  const updatedAt = listing.updatedAt.value
  await listing.changePage(2)
  expect(listing.errorMessage.value).toContain('审计日志响应不完整')
  expect(listing.currentPage.value).toBe(1)
  expect(listing.page.value.logs).toEqual([{ logId: 'first' }])
  expect(listing.updatedAt.value).toBe(updatedAt)

  await listing.changePage(2)
  expect(getAuditLogSummaryPageApi.mock.lastCall[0]).toEqual({ userId: 'user', limit: 20, offset: 20 })
  expect(listing.errorMessage.value).toBe('')
  expect(listing.currentPage.value).toBe(2)

  await listing.changePageSize(50)
  expect(listing.currentPage.value).toBe(2)
  expect(listing.pageSize.value).toBe(20)
  expect(listing.page.value.logs).toEqual([{ logId: 'second' }])

  await listing.applyFilters({ userId: 'other' })
  expect(listing.currentPage.value).toBe(1)
  expect(listing.page.value).toBeNull()
  expect(listing.updatedAt.value).toBeNull()
})
