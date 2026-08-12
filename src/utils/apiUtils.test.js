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

import { executeRequest, executeRequestWithStatus, withLoading } from './apiUtils.js'

const deferred = () => {
  let resolve
  const promise = new Promise((done) => {
    resolve = done
  })
  return { promise, resolve }
}

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

  it('reuses the common request pipeline for status-based requests', async () => {
    const onSuccess = vi.fn()
    const payload = { id: 'saved-item' }

    const result = await executeRequestWithStatus(async () => payload, {
      successMessages: { default: '保存完成' },
      onSuccess
    })

    expect(result).toBe(payload)
    expect(mocks.showSuccess).toHaveBeenCalledWith('保存完成')
    expect(onSuccess).toHaveBeenCalledWith(payload)
  })

  it('waits for asynchronous success callbacks before completing', async () => {
    const callback = deferred()
    const onSuccess = vi.fn(() => callback.promise)
    let completed = false

    const request = executeRequest(async () => 'saved', { onSuccess })
      .then(() => { completed = true })
    await Promise.resolve()

    expect(onSuccess).toHaveBeenCalledWith('saved')
    expect(completed).toBe(false)

    callback.resolve()
    await request
    expect(completed).toBe(true)
  })
})
