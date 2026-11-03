import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { deferred } from '@/test-support/deferred.js'

const { confirmAction } = vi.hoisted(() => ({ confirmAction: vi.fn() }))
vi.mock('@/utils/confirmUtils.js', () => ({ confirmAction }))

import { useConfirmClose } from './useConfirmClose.js'

beforeEach(() => {
  vi.resetAllMocks()
  confirmAction.mockResolvedValue(true)
})

describe('unsaved dialog close confirmation', () => {
  it('closes an unchanged dialog asynchronously through the supplied completion callback', async () => {
    const onClose = vi.fn()
    const done = vi.fn()
    const { handleBeforeClose } = useConfirmClose({ isDirty: ref(false), onClose })

    const pending = handleBeforeClose(done)
    expect(done).not.toHaveBeenCalled()
    await pending

    expect(done).toHaveBeenCalledOnce()
    expect(onClose).not.toHaveBeenCalled()
    expect(confirmAction).not.toHaveBeenCalled()
  })

  it('closes an unchanged dialog through its custom cancel button without prompting', async () => {
    const onClose = vi.fn()
    const { handleClose } = useConfirmClose({ isDirty: ref(false), onClose })

    await handleClose()

    expect(onClose).toHaveBeenCalledOnce()
    expect(confirmAction).not.toHaveBeenCalled()
  })

  it('uses the existing warning and button labels before completing a dirty dialog close', async () => {
    const onClose = vi.fn()
    const done = vi.fn()
    const { handleBeforeClose } = useConfirmClose({ isDirty: ref(true), onClose })

    await handleBeforeClose(done)

    expect(confirmAction).toHaveBeenCalledExactlyOnceWith({
      title: '放弃修改？',
      message: '当前修改尚未保存，关闭后会丢失。确认关闭？',
      confirmButtonText: '放弃修改',
      cancelButtonText: '继续编辑',
      type: 'warning'
    })
    expect(done).toHaveBeenCalledOnce()
    expect(onClose).not.toHaveBeenCalled()
  })

  it.each(['handleBeforeClose', 'handleClose'])('retains dirty changes when confirmation is cancelled: %s', async (method) => {
    const isDirty = ref(true)
    const onClose = vi.fn()
    const done = vi.fn()
    confirmAction.mockResolvedValueOnce(false)
    const dialog = useConfirmClose({ isDirty, onClose })

    await dialog[method](done)

    expect(confirmAction).toHaveBeenCalledOnce()
    expect(done).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(isDirty.value).toBe(true)
  })

  it('reads the current dirty state on every close attempt', async () => {
    const isDirty = ref(false)
    const onClose = vi.fn()
    const { handleClose } = useConfirmClose({ isDirty, onClose })

    await handleClose()
    isDirty.value = true
    await handleClose()

    expect(onClose).toHaveBeenCalledTimes(2)
    expect(confirmAction).toHaveBeenCalledOnce()
    expect(isDirty.value).toBe(true)
  })

  it('waits for confirmation before invoking the custom close handler', async () => {
    const confirmation = deferred()
    confirmAction.mockReturnValueOnce(confirmation.promise)
    const onClose = vi.fn()
    const { handleClose } = useConfirmClose({ isDirty: ref(true), onClose })

    const pending = handleClose()
    expect(onClose).not.toHaveBeenCalled()
    confirmation.resolve(true)
    await pending

    expect(onClose).toHaveBeenCalledOnce()
  })
})
