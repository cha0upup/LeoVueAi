import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFileSave } from './useFileSave.js'
import { editFileApi } from '@/services/api.js'
import { showError, showSuccess } from '@/utils/messageUtils.js'

vi.mock('@/services/api.js', () => ({ editFileApi: vi.fn() }))
vi.mock('@/utils/messageUtils.js', () => ({
  showError: vi.fn(),
  showSuccess: vi.fn()
}))

function fixture() {
  const content = ref('first revision')
  const modified = ref(true)
  const state = {
    canSave: ref(true),
    lineEnding: ref('LF'),
    currentEncoding: ref('utf-8'),
    originalContent: ref('old')
  }
  const onSaved = vi.fn((snapshot) => {
    state.originalContent.value = snapshot.content
    modified.value =
      content.value !== snapshot.content || state.lineEnding.value !== snapshot.lineEnding
  })
  const controller = useFileSave({
    getSnapshot: () =>
      state.canSave.value
        ? {
            sessionId: 's',
            filePath: '/file',
            content: content.value,
            lineEnding: state.lineEnding.value,
            encoding: state.currentEncoding.value
          }
        : null,
    onSaved
  })
  return { state, content, modified, onSaved, ...controller }
}
beforeEach(() => vi.resetAllMocks())
describe('saving a preview', () => {
  it('preserves edits made while the save request is pending', async () => {
    let finish
    editFileApi.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const { save, content, modified, state, isSaving } = fixture()
    const pending = save()
    content.value = 'second revision'
    finish({})
    await pending
    expect(editFileApi).toHaveBeenCalledWith(expect.objectContaining({ content: 'first revision' }))
    expect(content.value).toBe('second revision')
    expect(state.originalContent.value).toBe('first revision')
    expect(modified.value).toBe(true)
    expect(isSaving.value).toBe(false)
  })
  it('clears the dirty state only when the current content was saved', async () => {
    const { save, modified } = fixture()
    await save()
    expect(modified.value).toBe(false)
  })
  it('keeps the saved baseline after a failed request', async () => {
    editFileApi.mockRejectedValue(new Error('disk full'))
    const { save, modified, state } = fixture()
    await save()
    expect(state.originalContent.value).toBe('old')
    expect(modified.value).toBe(true)
  })
  it('normalizes saved line endings without leaving an unchanged editor dirty', async () => {
    const { save, content, modified, state } = fixture()
    content.value = 'one\ntwo'
    state.lineEnding.value = 'CRLF'
    await save()
    expect(editFileApi).toHaveBeenCalledWith(expect.objectContaining({ content: 'one\r\ntwo' }))
    expect(content.value).toBe('one\ntwo')
    expect(modified.value).toBe(false)
  })
  it('keeps the selected BOM on repeated saves while preserving editor content', async () => {
    const { save, content, state } = fixture()
    state.currentEncoding.value = 'utf-8-bom'
    await save()
    await save()
    expect(content.value).toBe('first revision')
    expect(editFileApi.mock.calls.map(([request]) => request.content)).toEqual([
      '\uFEFFfirst revision',
      '\uFEFFfirst revision'
    ])
  })
  it('ignores an old save response after closing and reopening the preview', async () => {
    let finishOld, finishNew
    editFileApi
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishOld = resolve
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishNew = resolve
          })
      )
    const { save, reset, isSaving, onSaved, content } = fixture()
    const oldSave = save()
    reset()
    content.value = 'reopened revision'
    const newSave = save()
    finishOld({})
    await oldSave
    expect(onSaved).not.toHaveBeenCalled()
    expect(showSuccess).not.toHaveBeenCalled()
    expect(showError).not.toHaveBeenCalled()
    expect(isSaving.value).toBe(true)
    finishNew({})
    await newSave
    expect(onSaved).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ content: 'reopened revision' })
    )
    expect(isSaving.value).toBe(false)
  })
  it('does not start a save without an editable snapshot or duplicate an in-flight save', async () => {
    const { save, state } = fixture()
    state.canSave.value = false
    await save()
    expect(editFileApi).not.toHaveBeenCalled()
    state.canSave.value = true
    const pending = save()
    await save()
    await pending
    expect(editFileApi).toHaveBeenCalledTimes(1)
  })
})
