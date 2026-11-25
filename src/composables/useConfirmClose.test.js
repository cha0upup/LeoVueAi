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

  it('closes a clean form directly and waits for confirmation after it is edited', async () => {
    const isDirty = ref(false)
    const onClose = vi.fn()
    const { handleClose } = useConfirmClose({ isDirty, onClose })

    await handleClose()
    expect(onClose).toHaveBeenCalledOnce()
    expect(confirmAction).not.toHaveBeenCalled()

    const confirmation = deferred()
    confirmAction.mockReturnValueOnce(confirmation.promise)
    isDirty.value = true
    const pending = handleClose()
    expect(confirmAction).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
    confirmation.resolve(true)
    await pending

    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
