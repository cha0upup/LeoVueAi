import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref, toRaw } from 'vue'

const { createEditor } = vi.hoisted(() => ({ createEditor: vi.fn() }))
vi.mock('@/utils/monaco.js', () => ({ monaco: { editor: { create: createEditor } } }))

import { createMonacoEditorOptions, disposeEditorInstance, recreateEditorInstance } from './monacoEditor.js'

function editorFixture(model = { dispose: vi.fn() }) {
  return { getModel: vi.fn(() => model), dispose: vi.fn() }
}

beforeEach(() => vi.resetAllMocks())

describe('Monaco editor utilities', () => {
  it('disposes the raw editor once and retains an externally owned model by default', () => {
    const model = { dispose: vi.fn() }
    const editor = editorFixture(model)
    const editorRef = ref(editor)

    disposeEditorInstance(editorRef)
    disposeEditorInstance(editorRef)

    expect(editor.getModel.mock.contexts).toEqual([editor])
    expect(editor.dispose.mock.contexts).toEqual([editor])
    expect(editor.dispose).toHaveBeenCalledOnce()
    expect(model.dispose).not.toHaveBeenCalled()
    expect(editorRef.value).toBeNull()
  })

  it('disposes an owned model before the editor', () => {
    const order = []
    const model = { dispose: vi.fn(() => order.push('model')) }
    const editor = editorFixture(model)
    editor.dispose.mockImplementation(() => order.push('editor'))
    const editorRef = ref(editor)

    disposeEditorInstance(editorRef, { disposeModel: true })

    expect(order).toEqual(['model', 'editor'])
    expect(editorRef.value).toBeNull()
  })

  it('disposes an editor even when it has no model', () => {
    const editor = editorFixture(null)
    const editorRef = ref(editor)

    disposeEditorInstance(editorRef, { disposeModel: true })

    expect(editor.dispose).toHaveBeenCalledOnce()
    expect(editorRef.value).toBeNull()
  })

  it('replaces an editor after cleanup and forwards the raw container and original options', () => {
    const model = { dispose: vi.fn() }
    const previous = editorFixture(model)
    const next = editorFixture()
    const editorRef = ref(previous)
    const container = {}
    const options = createMonacoEditorOptions({
      readOnly: true,
      wordWrap: 'on',
      minimapEnabled: true,
      minimap: { enabled: false, side: 'left' }
    })
    expect(options).toMatchObject({
      language: 'plaintext', automaticLayout: true, scrollBeyondLastLine: false,
      readOnly: true, wordWrap: 'on', fontSize: 14, lineNumbers: 'on',
      minimap: { enabled: false, side: 'left' }
    })
    createEditor.mockImplementation((actualContainer, actualOptions) => {
      expect(model.dispose).toHaveBeenCalledOnce()
      expect(previous.dispose).toHaveBeenCalledOnce()
      expect(editorRef.value).toBeNull()
      expect(actualContainer).toBe(container)
      expect(actualOptions).toBe(options)
      return next
    })

    const result = recreateEditorInstance(editorRef, ref(container), options, { disposeModel: true })

    expect(createEditor).toHaveBeenCalledOnce()
    expect(result).toBe(editorRef.value)
    expect(toRaw(result)).toBe(next)
  })

  it('cleans up without recreating when the container has not mounted', () => {
    const previous = editorFixture()
    const editorRef = ref(previous)

    expect(recreateEditorInstance(editorRef, ref(null), {})).toBeNull()

    expect(previous.dispose).toHaveBeenCalledOnce()
    expect(editorRef.value).toBeNull()
    expect(createEditor).not.toHaveBeenCalled()
  })

  it('preserves creation errors without retaining the disposed editor', () => {
    const previous = editorFixture()
    const editorRef = ref(previous)
    const error = new Error('editor fixture failed')
    createEditor.mockImplementation(() => { throw error })

    expect(() => recreateEditorInstance(editorRef, ref({}), {})).toThrow(error)
    expect(previous.dispose).toHaveBeenCalledOnce()
    expect(editorRef.value).toBeNull()
  })
})
