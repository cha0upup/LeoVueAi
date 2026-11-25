import { expect, it, vi } from 'vitest'
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

it('shows a download action instead of a Markdown or source viewer for unsupported content', () => {
  const renderer = createTestRenderer()
  const onDownload = vi.fn()
  const app = renderer.createApp({ render: () => Vue.h(Preview, {
    modelValue: true, path: 'fixture.md', data: { previewable: false }, onDownload
  }) })
  for (const name of ['ElDialog', 'ElButton']) app.component(name, createSlotStub(name))
  app.mount(renderer.root)
  try {
    expect(findNode(renderer.root, 'strong').text).toBe('此成果暂无文本预览')
    expect(findNode(renderer.root, 'article')).toBeNull()
    expect(findNode(renderer.root, 'SourcePreview')).toBeNull()
    expect(findNode(renderer.root, 'ElSegmented')).toBeNull()
    findNode(renderer.root, 'ElButton').props.onClick()
    expect(onDownload).toHaveBeenCalledOnce()
  } finally {
    app.unmount()
  }
})

it('mounts the source viewer only for source previews and unmounts it again after switching or closing', async () => {
  const renderer = createTestRenderer()
  const onDownload = vi.fn()
  const preview = Vue.reactive({ modelValue: true, path: 'report.md', data: { content: '# Fixture' }, onDownload })
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
    expect(findNode(renderer.root, 'ElButton')).toBeNull()

    selectMode('source')
    await Vue.nextTick()
    expect(source().props).toMatchObject({ content: '# Fixture', language: 'markdown' })
    expect(article()).toBeNull()

    selectMode('rendered')
    await Vue.nextTick()
    expect(article()).not.toBeNull()
    expect(source()).toBeNull()

    preview.path = 'notes.txt'
    preview.data = { content: 'Example text', truncated: true }
    await Vue.nextTick()
    expect(source().props).toMatchObject({ content: 'Example text', language: 'plaintext' })
    const download = findNode(renderer.root, 'ElButton')
    expect(findNode(download, 'text').text.trim()).toBe('下载完整文件')
    download.props.onClick()
    expect(onDownload).toHaveBeenCalledOnce()

    preview.modelValue = false
    await Vue.nextTick()
    expect(source()).toBeNull()
  } finally {
    app.unmount()
  }
})
