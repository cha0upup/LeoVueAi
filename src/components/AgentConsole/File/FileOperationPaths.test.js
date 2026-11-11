import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { compileClientComponent, createSlotStub, findNode, findNodes } from '@/test-support/vueComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import * as format from '@/utils/format.js'
import * as filePath from '@/composables/files/useFilePath.js'
import * as capabilities from './fileCapabilities.js'
import * as fileValidator from '@/utils/fileValidator.js'
import * as fileIcons from '@/utils/fileIcons.js'
import { icons } from '@/utils/icons.js'

const decompressFileApi = vi.fn()
const renameFileApi = vi.fn()
const modules = {
  '@iconify/vue': { Icon: createSlotStub('Icon') },
  '@/utils/icons.js': { icons },
  '@/utils/format.js': format,
  '@/composables/files/useFilePath.js': filePath,
  './fileCapabilities.js': capabilities,
  '@/utils/fileValidator.js': fileValidator,
  '@/utils/fileIcons.js': fileIcons,
  '@/services/api/agent-files.js': { decompressFileApi, renameFileApi },
  '@/utils/messageUtils.js': { showInfo: vi.fn(), showSuccess: vi.fn(), showError: vi.fn() },
  '@/components/AgentConsole/File/FileOperationSummary.vue': { default: createSlotStub('Summary') }
}
const Decompress = compileClientComponent(new URL('./FileDecompress.vue', import.meta.url), modules)
const Rename = compileClientComponent(new URL('./FileRename.vue', import.meta.url), modules)
const Form = defineComponent({
  setup(_props, { attrs, slots, expose }) {
    expose({ validate: () => Promise.resolve(), clearValidate() {} })
    return () => h('ElForm', attrs, slots.default?.())
  }
})
const apps = []
afterEach(() => { apps.splice(0).forEach(app => app.unmount()); vi.clearAllMocks() })

async function open(component, props) {
  const renderer = createTestRenderer()
  const dialog = ref(null)
  const app = renderer.createApp({ render: () => h(component, { ...props, ref: dialog }) })
  app.component('ElForm', Form)
  for (const name of ['ElDialog', 'ElFormItem', 'ElInput', 'ElSelect', 'ElOption', 'ElButton', 'ElIcon']) {
    app.component(name, createSlotStub(name))
  }
  app.mount(renderer.root)
  apps.push(app)
  dialog.value.openDialog()
  await nextTick()
  return renderer.root
}

const text = node => node.text + node.children.map(text).join('')
const directories = [
  { disk: '/', currentPath: '', base: '/' },
  { disk: 'C:', currentPath: '\\Temp\\', base: 'C:/Temp/' },
  { disk: '//server/share', currentPath: '/folder', base: '//server/share/folder/' }
]

describe('shared paths in file operation dialogs', () => {
  it.each(directories)('keeps extraction source and output rooted at $base', async ({ disk, currentPath, base }) => {
    const root = await open(Decompress, { sessionId: 'session', disk, currentPath, file: { name: '备份.tar.gz' } })
    expect(findNode(root, 'Summary').props.path).toBe(`${base}备份.tar.gz`)
    expect(findNode(root, 'ElForm').props.model.targetPath).toBe(`${base}备份`)
    const submit = findNodes(root, node => node.type === 'ElButton' && node.props.type === 'primary')[0]
    await submit.props.onClick()
    expect(decompressFileApi).toHaveBeenCalledExactlyOnceWith({
      sessionId: 'session', src: `${base}备份.tar.gz`, des: `${base}备份`, format: 'tar.gz'
    })
  })

  it.each(directories)('keeps rename preview and submitted path rooted at $base', async ({ disk, currentPath, base }) => {
    const root = await open(Rename, { sessionId: 'session', disk, currentPath, file: { name: 'old.txt' } })
    expect(findNode(root, 'Summary').props.path).toBe(`${base}old.txt`)
    findNode(root, 'ElForm').props.model.newName = ' new.txt '
    await nextTick()
    expect(text(root)).toContain(`${base}new.txt`)
    const submit = findNodes(root, node => node.type === 'ElButton' && node.props.type === 'primary')[0]
    await submit.props.onClick()
    expect(renameFileApi).toHaveBeenCalledExactlyOnceWith({
      sessionId: 'session', path: `${base}old.txt`, newName: 'new.txt'
    })
  })
})
