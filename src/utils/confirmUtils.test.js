import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deferred } from '@/test-support/deferred.js'

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  showSuccess: vi.fn(),
  showWarning: vi.fn(),
  showError: vi.fn()
}))

vi.mock('element-plus', () => ({
  ElMessageBox: { confirm: mocks.confirm }
}))

vi.mock('./messageUtils.js', () => ({
  showSuccess: mocks.showSuccess,
  showWarning: mocks.showWarning,
  showError: mocks.showError
}))

import { confirmAction, executeBatchDelete, executeDeleteWithConfirm } from './confirmUtils.js'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.confirm.mockResolvedValue(undefined)
})

it('forwards dialog options while keeping untrusted confirmation content in text mode', async () => {
  const message = '<b>项目名称</b>'
  await expect(confirmAction({
    title: '确认操作', message, dangerouslyUseHTMLString: true, closeOnClickModal: false, showCancelButton: false
  })).resolves.toBe(true)

  expect(mocks.confirm).toHaveBeenCalledExactlyOnceWith(message, '确认操作', expect.objectContaining({
    showCancelButton: false, closeOnClickModal: false, dangerouslyUseHTMLString: false
  }))
})

describe('executeBatchDelete', () => {
  it('runs deletes sequentially and reports partial success after one fails', async () => {
    let active = 0
    let maxActive = 0
    const deleteFn = vi.fn(async (item) => {
      active += 1
      maxActive = Math.max(maxActive, active)
      await Promise.resolve()
      active -= 1
      if (item === 'b') throw new Error('busy')
    })
    const onSuccess = vi.fn()
    const result = await executeBatchDelete(['a', 'b', 'c'], deleteFn, { itemName: '主机', onSuccess })

    expect(result).toEqual({ successCount: 2, failCount: 1 })
    expect(deleteFn.mock.calls).toEqual([['a'], ['b'], ['c']])
    expect(maxActive).toBe(1)
    expect(onSuccess).toHaveBeenCalledExactlyOnceWith(result)
    expect(mocks.showWarning).toHaveBeenCalledWith('部分删除成功：成功 2 个，失败 1 个')
  })

  it('reports a failed batch and releases loading without a success callback', async () => {
    const loadingRef = { value: false }
    const onSuccess = vi.fn()
    const deleteFn = vi.fn().mockRejectedValue(new Error('delete failed'))

    await expect(executeBatchDelete(['a', 'b'], deleteFn, {
      itemName: '指纹', loadingRef, onSuccess
    })).rejects.toThrow('批量删除失败')

    expect(deleteFn).toHaveBeenCalledTimes(2)
    expect(onSuccess).not.toHaveBeenCalled()
    expect(mocks.showError).toHaveBeenCalledExactlyOnceWith('删除指纹失败，请稍后重试')
    expect(loadingRef.value).toBe(false)
  })
})

describe('delete request lifecycle', () => {
  it.each([
    ['single', (deleteFn, options) => executeDeleteWithConfirm(deleteFn, options)],
    ['batch', (deleteFn, options) => executeBatchDelete(['a'], deleteFn, options)]
  ])('does not run the %s request when confirmation is cancelled', async (_name, run) => {
    mocks.confirm.mockRejectedValueOnce('cancel')
    const deleteFn = vi.fn()
    const onSuccess = vi.fn()
    const loadingRef = { value: false }

    await expect(run(deleteFn, { loadingRef, onSuccess })).resolves.toBe(false)

    expect(deleteFn).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
    expect(mocks.showError).not.toHaveBeenCalled()
    expect(loadingRef.value).toBe(false)
  })

  it('keeps batch deletion loading active until the refresh completes', async () => {
    const { promise: started, resolve: startRefresh } = deferred()
    const { promise: refresh, resolve: finishRefresh } = deferred()
    const loadingRef = { value: false }
    const onSuccess = vi.fn(() => {
      startRefresh()
      return refresh
    })

    const request = executeBatchDelete(['a'], async () => {}, { loadingRef, onSuccess })
    await started
    expect(loadingRef.value).toBe(true)
    expect(onSuccess).toHaveBeenCalledWith({ successCount: 1, failCount: 0 })

    finishRefresh()
    await request
    expect(loadingRef.value).toBe(false)
  })

  it('surfaces refresh failures and clears loading instead of losing the rejection', async () => {
    const failure = new Error('刷新失败')
    const loadingRef = { value: false }
    const onError = vi.fn()
    await expect(executeDeleteWithConfirm(async () => 'deleted', {
      loadingRef,
      successMessage: null,
      errorMessage: null,
      onSuccess: async () => { throw failure },
      onError
    })).rejects.toBe(failure)

    expect(onError).toHaveBeenCalledExactlyOnceWith(failure)
    expect(mocks.showError).not.toHaveBeenCalled()
    expect(loadingRef.value).toBe(false)
  })
})
