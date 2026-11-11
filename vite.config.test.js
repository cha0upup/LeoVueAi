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

describe('editor build boundary', () => {
  it('keeps the shared preload helper separate without splitting Monaco internals', () => {
    const assign = config.build.rollupOptions.output.manualChunks
    expect(assign('\0vite/preload-helper.js')).toBe('preload-helper')
    expect(assign(editorModule)).toBe('vendor-editor')
    expect(assign('/app/node_modules/monaco-editor/esm/vs/base/common/event.js')).toBe('vendor-editor')
  })

  it.each([false, true])('rejects editor modules in the initial static graph (indirect=%s)', indirect => {
    const chunks = [chunk('entry.js', [indirect ? 'shared.js' : 'large.js'], [], true),
      chunk('shared.js', ['large.js']), chunk('large.js', [], [editorModule])]
    expect(() => check(chunks)).toThrow('Monaco must stay outside the initial static import graph: large.js')
  })

  it('allows lazy editor loading and terminates on shared static cycles', () => {
    expect(() => check([
      chunk('entry.js', ['shared.js'], [], true, ['editor-view.js']),
      chunk('shared.js', ['entry.js', 'external.js']),
      chunk('editor-view.js', ['large.js']), chunk('large.js', [], [editorModule])
    ])).not.toThrow()
  })
})
