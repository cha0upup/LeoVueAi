import { describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { useDialogVisible } from './useDialogVisible.js'

describe('dialog model binding', () => {
  it('tracks the parent model value reactively', () => {
    const props = reactive({ modelValue: false })
    const visible = useDialogVisible(props, vi.fn())
    expect(visible.value).toBe(false)
    props.modelValue = true
    expect(visible.value).toBe(true)
    props.modelValue = false
    expect(visible.value).toBe(false)
  })

  it('emits boolean model updates without mutating the parent props', () => {
    const props = reactive({ modelValue: true })
    const emit = vi.fn()
    const visible = useDialogVisible(props, emit)
    visible.value = false
    expect(emit).toHaveBeenLastCalledWith('update:modelValue', false)
    expect(props.modelValue).toBe(true)
    visible.value = 1
    expect(emit).toHaveBeenLastCalledWith('update:modelValue', true)
    expect(emit).toHaveBeenCalledTimes(2)
  })

  it('keeps each dialog bound to its own parent and emitter', () => {
    const firstProps = reactive({ modelValue: true })
    const secondProps = reactive({ modelValue: false })
    const firstEmit = vi.fn()
    const secondEmit = vi.fn()
    const first = useDialogVisible(firstProps, firstEmit)
    const second = useDialogVisible(secondProps, secondEmit)
    first.value = false
    expect(firstEmit).toHaveBeenCalledOnce()
    expect(secondEmit).not.toHaveBeenCalled()
    expect(second.value).toBe(false)
    secondProps.modelValue = true
    expect(second.value).toBe(true)
    expect(firstProps.modelValue).toBe(true)
  })
})
