import { beforeEach, describe, expect, it, vi } from 'vitest'

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

import { executeBatchDelete } from './confirmUtils.js'

describe('executeBatchDelete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.confirm.mockResolvedValue(undefined)
  })

  it('serializes delete requests so SQLite writes do not contend for a lock', async () => {
    const order = []
    let active = 0
    let maxActive = 0
    const deleteFn = vi.fn(async (item) => {
      active += 1
      maxActive = Math.max(maxActive, active)
      order.push(item)
      await Promise.resolve()
      active -= 1
    })

    const result = await executeBatchDelete(['a', 'b', 'c'], deleteFn, {
      itemName: '主机',
      loadingRef: { value: false }
    })

    expect(result).toEqual({ successCount: 3, failCount: 0 })
    expect(order).toEqual(['a', 'b', 'c'])
    expect(maxActive).toBe(1)
  })

  it('continues after an individual failure and reports partial results', async () => {
    const deleteFn = vi.fn(async (item) => {
      if (item === 'b') throw new Error('busy')
    })

    const result = await executeBatchDelete(['a', 'b', 'c'], deleteFn, {
      itemName: '主机'
    })

    expect(result).toEqual({ successCount: 2, failCount: 1 })
    expect(deleteFn).toHaveBeenCalledTimes(3)
    expect(mocks.showWarning).toHaveBeenCalledWith('部分删除成功：成功 2 个，失败 1 个')
  })
})
