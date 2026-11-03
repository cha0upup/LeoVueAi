import { describe, expect, it } from 'vitest'
import { useDialog, useEditDialog } from './dialogUtils.js'

describe('dialog state', () => {
  it('opens and closes a dialog', () => {
    const dialog = useDialog()
    expect(dialog.visible.value).toBe(false)
    dialog.open()
    expect(dialog.visible.value).toBe(true)
    dialog.close()
    expect(dialog.visible.value).toBe(false)
  })

  it('keeps separate dialogs independent', () => {
    const first = useDialog()
    const second = useDialog()
    first.open()
    expect(second.visible.value).toBe(false)
    second.open()
    first.close()
    expect(second.visible.value).toBe(true)
  })

  it('clears the selected item when an edit dialog closes', () => {
    const dialog = useEditDialog()
    expect(dialog.currentItem.value).toBeNull()
    dialog.open({ id: 'first' })
    expect(dialog.currentItem.value).toEqual({ id: 'first' })
    expect(dialog.visible.value).toBe(true)
    dialog.close()
    expect(dialog.currentItem.value).toBeNull()
    expect(dialog.visible.value).toBe(false)
  })

  it('opens a create dialog without retaining a previous edit selection', () => {
    const dialog = useEditDialog()
    dialog.open({ id: 'previous' })
    dialog.open()
    expect(dialog.visible.value).toBe(true)
    expect(dialog.currentItem.value).toBeNull()
  })
})
