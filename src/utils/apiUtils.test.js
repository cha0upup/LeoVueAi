import { deferred } from '@/test-support/deferred.js'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  handleError: vi.fn(),
  showSuccess: vi.fn()
}))

vi.mock('./errorHandler.js', () => ({
  handleError: mocks.handleError
}))

vi.mock('./messageUtils.js', () => ({
  showSuccess: mocks.showSuccess
}))

import { executeRequest, withLoading } from './apiUtils.js'

describe('apiUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps a shared loading ref active until every concurrent request finishes', async () => {
    const loading = ref(false)
    const first = deferred()
    const second = deferred()

    const firstRequest = withLoading(loading, () => first.promise)
    const secondRequest = withLoading(loading, () => second.promise)
    expect(loading.value).toBe(true)

    first.resolve('first')
    await firstRequest
    expect(loading.value).toBe(true)

    second.resolve('second')
    await secondRequest
    expect(loading.value).toBe(false)
  })

  it('treats an empty response as success and waits for asynchronous completion', async () => {
    const loading = ref(false)
    const callback = deferred()
    const onSuccess = vi.fn(() => callback.promise)
    let completed = false

    const request = executeRequest(async () => undefined, {
      onSuccess, loadingRef: loading, successMessage: '保存成功'
    }).then(result => {
      completed = true
      return result
    })
    await Promise.resolve()

    expect(onSuccess).toHaveBeenCalledExactlyOnceWith(undefined)
    expect(completed).toBe(false)
    expect(loading.value).toBe(true)

    callback.resolve()
    await expect(request).resolves.toBeUndefined()
    expect(completed).toBe(true)
    expect(loading.value).toBe(false)
    expect(mocks.showSuccess).toHaveBeenCalledExactlyOnceWith('保存成功')
    expect(mocks.handleError).not.toHaveBeenCalled()
  })

  it('lets callers handle errors without displaying a duplicate default message', async () => {
    const failure = new Error('验证失败')
    const loading = ref(false)
    const onError = vi.fn()
    await expect(executeRequest(async () => { throw failure }, {
      loadingRef: loading,
      errorMessage: null,
      onError
    })).rejects.toBe(failure)

    expect(onError).toHaveBeenCalledExactlyOnceWith(failure)
    expect(mocks.handleError).not.toHaveBeenCalled()
    expect(mocks.showSuccess).not.toHaveBeenCalled()
    expect(loading.value).toBe(false)
  })

  it('keeps loading active while asynchronous error handling finishes', async () => {
    const failure = new Error('保存失败')
    const callback = deferred()
    const loading = ref(false)
    const onError = vi.fn(() => callback.promise)
    const request = executeRequest(async () => { throw failure }, {
      loadingRef: loading,
      errorMessage: '操作失败',
      errorMessages: { 409: '名称重复' },
      onError
    })
    const rejected = expect(request).rejects.toBe(failure)
    await Promise.resolve()

    expect(onError).toHaveBeenCalledWith(failure)
    expect(loading.value).toBe(true)
    expect(mocks.handleError).toHaveBeenCalledWith(failure, {
      defaultMessage: '操作失败',
      defaultMessages: { 409: '名称重复' }
    })

    callback.resolve()
    await rejected
    expect(loading.value).toBe(false)
  })
})
