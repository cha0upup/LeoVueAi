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

import { confirmAction, executeBatchDelete, executeDeleteWithConfirm } from './confirmUtils.js'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.confirm.mockResolvedValue(undefined)
})

describe('confirmAction', () => {
  it.each([true, false])('preserves AI configuration dialog options for admin=%s', async (isAdmin) => {
    const options = {
      title: '无可用 AI 模型',
      message: isAdmin ? '请前往系统配置' : '请联系管理员',
      confirmButtonText: isAdmin ? '前往配置' : '知道了',
      showCancelButton: isAdmin,
      closeOnClickModal: false,
      closeOnPressEscape: true
    }

    await expect(confirmAction(options)).resolves.toBe(true)

    expect(mocks.confirm).toHaveBeenCalledExactlyOnceWith(options.message, options.title, {
      confirmButtonText: options.confirmButtonText,
      cancelButtonText: '取消',
      confirmButtonClass: undefined,
      type: 'warning',
      showCancelButton: isAdmin,
      closeOnClickModal: false,
      closeOnPressEscape: true,
      dangerouslyUseHTMLString: false
    })
  })

  it.each(['cancel', 'close'])('returns false without notifications when the dialog rejects with %s', async (reason) => {
    mocks.confirm.mockRejectedValueOnce(reason)

    await expect(confirmAction({ message: '继续？' })).resolves.toBe(false)

    expect(mocks.showError).not.toHaveBeenCalled()
    expect(mocks.showWarning).not.toHaveBeenCalled()
    expect(mocks.showSuccess).not.toHaveBeenCalled()
  })

  it('keeps the project deletion severity and custom button labels', async () => {
    await confirmAction({
      title: '删除项目', message: '确认删除？', type: 'error',
      confirmButtonText: '确认删除', cancelButtonText: '保留项目'
    })

    expect(mocks.confirm).toHaveBeenCalledExactlyOnceWith('确认删除？', '删除项目', {
      confirmButtonText: '确认删除', cancelButtonText: '保留项目',
      confirmButtonClass: undefined, type: 'error', dangerouslyUseHTMLString: false
    })
  })

  it('keeps confirmation content in text mode when forwarding custom options', async () => {
    const message = '<b>项目名称</b>'
    await confirmAction({ message, dangerouslyUseHTMLString: true, closeOnClickModal: false })

    expect(mocks.confirm).toHaveBeenCalledExactlyOnceWith(message, '提示', {
      confirmButtonText: '确定', cancelButtonText: '取消',
      confirmButtonClass: undefined, type: 'warning', closeOnClickModal: false,
      dangerouslyUseHTMLString: false
    })
  })
})

describe('executeBatchDelete', () => {
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
    const onSuccess = vi.fn()
    const deleteFn = vi.fn(async (item) => {
      if (item === 'b') throw new Error('busy')
    })

    const result = await executeBatchDelete(['a', 'b', 'c'], deleteFn, {
      itemName: '主机',
      onSuccess
    })

    expect(result).toEqual({ successCount: 2, failCount: 1 })
    expect(deleteFn).toHaveBeenCalledTimes(3)
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

  it.each([
    ['single', () => executeDeleteWithConfirm(async () => {}, {
      title: '删除确认', message: '确认删除指纹？',
      confirmButtonText: '删除', confirmButtonClass: 'el-button--danger'
    }), '确认删除指纹？', '删除确认'],
    ['batch', () => executeBatchDelete(['a'], async () => {}, {
      confirmMessage: '确认删除自定义伪装？内置伪装将被跳过。'
    }), '确认删除自定义伪装？内置伪装将被跳过。', '批量删除确认']
  ])('preserves the %s confirmation message and delete button', async (_name, run, message, title) => {
    await run()

    expect(mocks.confirm).toHaveBeenCalledExactlyOnceWith(message, title, {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      confirmButtonClass: 'el-button--danger',
      type: 'warning',
      dangerouslyUseHTMLString: false
    })
  })

  it.each([
    ['single', options => executeDeleteWithConfirm(async () => 'deleted', options), 'deleted'],
    ['batch', options => executeBatchDelete(['a'], async () => {}, options), { successCount: 1, failCount: 0 }]
  ])('keeps loading active until the %s deletion refresh completes', async (_name, run, expected) => {
    let startRefresh, finishRefresh
    const started = new Promise(resolve => { startRefresh = resolve })
    const refresh = new Promise(resolve => { finishRefresh = resolve })
    const loadingRef = { value: false }
    const onSuccess = vi.fn(() => {
      startRefresh()
      return refresh
    })

    const request = run({ loadingRef, onSuccess })
    await started
    expect(loadingRef.value).toBe(true)
    expect(onSuccess).toHaveBeenCalledWith(expected)

    finishRefresh()
    await expect(request).resolves.toEqual(expected)
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
