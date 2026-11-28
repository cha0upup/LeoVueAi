import { effectScope } from 'vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { deferred } from '@/test-support/deferred.js'
import { getBasicInfoApi } from '@/services/api/agent-node.js'
import { handleError } from '@/utils/errorHandler.js'
import { useBasicInfo } from './useBasicInfo.js'

vi.mock('@/services/api/agent-node.js', () => ({
  getBasicInfoApi: vi.fn()
}))
vi.mock('@/utils/errorHandler.js', () => ({ handleError: vi.fn() }))

let scope, info
beforeEach(() => {
  vi.resetAllMocks()
  scope = effectScope()
  info = scope.run(useBasicInfo)
})
afterEach(() => scope.stop())

it('ignores an older host response while the current request is loading', async () => {
  const { promise: oldResponse, resolve: finishOld } = deferred()
  const { promise: newResponse, resolve: finishNew } = deferred()
  getBasicInfoApi
    .mockReturnValueOnce(oldResponse)
    .mockReturnValueOnce(newResponse)
  const oldLoad = info.load('old-session')
  const newLoad = info.load('new-session')
  expect(getBasicInfoApi.mock.calls[0][1]?.signal.aborted).toBe(true)
  expect(getBasicInfoApi.mock.lastCall[1]?.signal.aborted).toBe(false)
  finishOld({ data: { BasicInfo: { OSInfo: { HostName: 'old' } } } })
  await oldLoad
  expect(info.basicInfo.value).toEqual({})
  expect(info.loading.value).toBe(true)
  finishNew({ data: { BasicInfo: { OSInfo: { HostName: 'new' } } } })
  await newLoad
  expect(info.basicInfo.value.OSInfo.HostName).toBe('new')
  expect(info.loading.value).toBe(false)
})

it('discards pending errors when the view is disposed', async () => {
  const { promise, reject: fail } = deferred()
  getBasicInfoApi.mockReturnValueOnce(promise)
  const pending = info.load('session')
  scope.stop()
  expect(getBasicInfoApi.mock.lastCall[1]?.signal.aborted).toBe(true)
  fail(new Error('disconnected'))
  await pending
  expect(handleError).not.toHaveBeenCalled()
  expect(info.error.value).toBe('')
  expect(info.loading.value).toBe(false)
})

it('shares a pending read and allows an explicit refresh after it completes', async () => {
  const pending = deferred()
  getBasicInfoApi.mockReturnValueOnce(pending.promise)
  const first = info.load('session')
  const duplicate = info.load('session')

  expect(getBasicInfoApi).toHaveBeenCalledOnce()
  expect(getBasicInfoApi.mock.lastCall[1]?.signal.aborted).toBe(false)
  pending.resolve({ data: { BasicInfo: { collectTime: 'first' } } })
  await Promise.all([first, duplicate])
  expect(info.basicInfo.value.collectTime).toBe('first')

  getBasicInfoApi.mockResolvedValueOnce({ data: { BasicInfo: { collectTime: 'second' } } })
  await info.load('session')
  expect(getBasicInfoApi).toHaveBeenCalledTimes(2)
  expect(info.basicInfo.value.collectTime).toBe('second')
})
