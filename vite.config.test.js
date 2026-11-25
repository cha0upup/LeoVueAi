import { describe, expect, it } from 'vitest'
import config from './vite.config.js'

const boundary = config.plugins.find(plugin => plugin.name === 'editor-entry-boundary')
const chunk = (fileName, imports = [], modules = [], isEntry = false, dynamicImports = []) => ({
  type: 'chunk', fileName, imports, isEntry, dynamicImports,
  modules: Object.fromEntries(modules.map(id => [id, {}]))
})
const check = chunks => boundary.generateBundle.call({
  error: message => { throw new Error(message) }
}, {}, Object.fromEntries(chunks.map(chunk => [chunk.fileName, chunk])))
const editorModule = '/app/node_modules/monaco-editor/esm/vs/editor/editor.api.js'
const artifactLibrary = '/app/src/components/UserSpace/UserSpace.vue'

describe('editor build boundary', () => {
  it('keeps Monaco base and editor modules in the same chunk', () => {
    const assign = config.build.rollupOptions.output.manualChunks
    const editorChunk = assign(editorModule)
    expect(editorChunk).toBeTruthy()
    expect(assign('/app/node_modules/monaco-editor/esm/vs/base/common/event.js')).toBe(editorChunk)
  })

  it('rejects editor modules reached through a shared entry dependency', () => {
    const chunks = [chunk('entry.js', ['shared.js'], [], true),
      chunk('shared.js', ['large.js']), chunk('large.js', [], [editorModule])]
    expect(() => check(chunks)).toThrow(/Monaco must stay outside the initial static import graph.*large\.js/)
  })

  it('requires the artifact library to defer Monaco even though the library is already a lazy route chunk', () => {
    const entry = chunk('entry.js', [], [], true, ['artifacts.js'])
    const sourcePreview = chunk('source.js', [], [editorModule])
    expect(() => check([
      entry, chunk('artifacts.js', ['source.js'], [artifactLibrary]), sourcePreview
    ])).toThrow(/Monaco.*artifact library: source\.js/)
    expect(() => check([
      entry, chunk('artifacts.js', [], [artifactLibrary], false, ['source.js']), sourcePreview
    ])).not.toThrow()
  })

  it('allows lazy editor loading and terminates on shared static cycles', () => {
    expect(() => check([
      chunk('entry.js', ['shared.js'], [], true, ['editor-view.js']),
      chunk('shared.js', ['entry.js', 'external.js']),
      chunk('editor-view.js', ['large.js']), chunk('large.js', [], [editorModule])
    ])).not.toThrow()
  })
})
