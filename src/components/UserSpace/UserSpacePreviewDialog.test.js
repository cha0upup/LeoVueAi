import { expect, it } from 'vitest'
import * as Vue from 'vue'
import { compileClientComponent, createSlotStub, findNode } from '@/test-support/vueComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import { useDialogVisible } from '@/composables/useDialogVisible.js'
import { formatFileSize } from '@/utils/format.js'
import { detectUserSpaceLanguage } from './userSpaceModel.js'

const Preview = compileClientComponent(new URL('./UserSpacePreviewDialog.vue', import.meta.url), {
  vue: { ...Vue, defineAsyncComponent: () => createSlotStub('SourcePreview') },
  '@/composables/useDialogVisible.js': { useDialogVisible },
  '@/utils/format.js': { formatFileSize },
  './userSpaceModel.js': { detectUserSpaceLanguage },
  './artifactMarkdown.js': { renderArtifactMarkdown: () => '<h1>Fixture</h1>' }
})

it('mounts the source viewer only for source previews and unmounts it again after switching or closing', async () => {
  const renderer = createTestRenderer()
  const preview = Vue.reactive({ modelValue: true, path: 'report.md', data: { content: '# Fixture' } })
  const app = renderer.createApp({ render: () => Vue.h(Preview, { ...preview }) })
  for (const name of ['ElDialog', 'ElTag', 'ElSegmented', 'ElAlert', 'ElButton']) {
    app.component(name, createSlotStub(name))
  }
  app.mount(renderer.root)
  try {
    const source = () => findNode(renderer.root, 'SourcePreview')
    const article = () => findNode(renderer.root, 'article')
    const selectMode = (mode) => findNode(renderer.root, 'ElSegmented').props['onUpdate:modelValue'](mode)

    expect(article()).not.toBeNull()
    expect(source()).toBeNull()

    selectMode('source')
    await Vue.nextTick()
    expect(source().props).toMatchObject({ content: '# Fixture', language: 'markdown' })
    expect(article()).toBeNull()

    selectMode('rendered')
    await Vue.nextTick()
    expect(article()).not.toBeNull()
    expect(source()).toBeNull()

    preview.path = 'notes.txt'
    preview.data = { content: 'Example text' }
    await Vue.nextTick()
    expect(source().props).toMatchObject({ content: 'Example text', language: 'plaintext' })

    preview.modelValue = false
    await Vue.nextTick()
    expect(source()).toBeNull()
  } finally {
    app.unmount()
  }
})
