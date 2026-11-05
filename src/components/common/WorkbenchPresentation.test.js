import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive } from 'vue'
import { compileClientComponent, createSlotStub as stub, findNodes } from '@/test-support/vueComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import { useDialogVisible } from '@/composables/useDialogVisible.js'
import { icons } from '@/utils/icons.js'
import * as pluginForms from '@/utils/plugin.js'
import * as modelLabels from '@/components/Settings/aiChannelSettingsModel.js'

const PageHeader = compileClientComponent(new URL('./PageHeader.vue', import.meta.url))
const StatsStrip = compileClientComponent(new URL('./StatsStrip.vue', import.meta.url))
const EntityCard = compileClientComponent(new URL('./EntityCard.vue', import.meta.url), {
  '@iconify/vue': { Icon: stub('Icon') }
})
const EmptyState = compileClientComponent(new URL('./EmptyState.vue', import.meta.url), {
  '@iconify/vue': { Icon: stub('Icon') }
})
const ManagerLayout = compileClientComponent(new URL('./ManagerLayout.vue', import.meta.url), {
  './SplitterBar.vue': { default: stub('SplitterBar') }
})
const AppHeader = compileClientComponent(new URL('./AppHeader.vue', import.meta.url), {
  '@iconify/vue': { Icon: stub('Icon') },
  '@/components/common/ThemeSwitcher.vue': { default: stub('ThemeSwitcher') },
  '@/utils/icons.js': { icons }
})
const validate = vi.fn()
const warning = vi.fn()
const Form = defineComponent({
  setup(_props, { slots, expose }) {
    expose({ validate })
    return () => h('ElForm', slots.default?.())
  }
})
const PluginDialog = compileClientComponent(new URL('../PluginManager/PluginFormDialog.vue', import.meta.url), {
  '@iconify/vue': { Icon: stub('Icon') },
  '@/utils/icons.js': { icons },
  '@/utils/messageUtils.js': { showWarning: warning },
  '@/composables/useDialogVisible.js': { useDialogVisible },
  '@/utils/plugin.js': pluginForms,
  './PluginFormFields.vue': { default: stub('PluginFormFields') }
})
const ModelDetail = compileClientComponent(new URL('../Settings/AiModelDetailPanel.vue', import.meta.url), {
  './aiChannelSettingsModel.js': modelLabels
})
const text = node => node.type === 'comment' ? '' : node.text + node.children.map(text).join('')
const apps = []
afterEach(() => { apps.splice(0).forEach(app => app.unmount()); vi.clearAllMocks() })

function mount(component, props = {}, slots = {}) {
  const renderer = createTestRenderer()
  const app = renderer.createApp({ render: () => h(component, props, slots) })
  for (const name of ['ElIcon', 'Icon', 'ElButton', 'ElTag', 'ElEmpty', 'ElCheckbox']) app.component(name, stub(name))
  app.component('ElForm', Form)
  app.component('ElDialog', stub('ElDialog', ['default', 'footer']))
  for (const name of ['ElHeader', 'ElAvatar', 'ElDropdownMenu', 'ElDropdownItem']) app.component(name, stub(name))
  app.component('ElDropdown', stub('ElDropdown', ['default', 'dropdown']))
  app.component('ElTooltip', stub('ElTooltip', ['default', 'content']))
  app.mount(renderer.root)
  apps.push(app)
  return {
    nodes: type => findNodes(renderer.root).filter(node => node.type === type),
    button: label => findNodes(renderer.root).find(node => node.type === 'ElButton' && text(node).trim() === label)
  }
}

describe('shared workbench presentation', () => {
  it('keeps card activation and batch checkbox behavior independent', async () => {
    const click = vi.fn()
    const toggle = vi.fn()
    const state = reactive({ title: '目录条目', icon: icons.plugin, selected: false,
      inSelectionMode: false, onClick: click, onToggleSelected: toggle })
    const view = mount(EntityCard, state, {
      status: () => h('span', 'Java'), extra: () => h('span', 'v1.0.0'), actions: () => h('button', '导出')
    })
    const card = () => view.nodes('div').find(node => node.props.role === 'button')
    expect(view.nodes('ElCheckbox')).toHaveLength(1)
    card().props.onClick()
    card().props.onKeyup({ key: 'Enter' })
    expect(click).toHaveBeenCalledTimes(2)
    expect(toggle).not.toHaveBeenCalled()
    state.inSelectionMode = true
    await nextTick()
    card().props.onClick()
    expect(toggle).toHaveBeenLastCalledWith(true)
    expect(click).toHaveBeenCalledTimes(2)
    view.nodes('ElCheckbox')[0].props.onChange(false)
    expect(toggle).toHaveBeenLastCalledWith(false)
    expect(view.nodes('span').map(text)).toEqual(expect.arrayContaining(['Java', 'v1.0.0']))
    expect(view.nodes('button').map(text)).toContain('导出')
  })

  it('keeps compact empty descriptions without rendering unused controls', () => {
    const view = mount(EmptyState, { compact: true, description: '没有匹配项' })
    expect(view.nodes('ElEmpty')[0].props).toMatchObject({ description: '没有匹配项', 'image-size': 60 })
    expect(view.nodes('ElButton')).toHaveLength(0)
  })

  it('preserves artifact empty-state actions and lets host actions use the default slot', () => {
    const action = vi.fn()
    const view = mount(EmptyState, { workbench: true, title: '暂无成果', icon: icons.folderOpened,
      description: '导入文件后显示', actionLabel: '导入文件', onAction: action })
    expect(view.nodes('h3').map(text)).toEqual(['暂无成果'])
    view.button('导入文件').props.onClick()
    expect(action).toHaveBeenCalledOnce()
    const custom = vi.fn()
    const slotted = mount(EmptyState, { workbench: true, actionLabel: '被插槽替代' }, {
      default: () => h('button', { onClick: custom }, '新增主机')
    })
    expect(slotted.nodes('ElButton')).toHaveLength(0)
    slotted.nodes('button')[0].props.onClick()
    expect(custom).toHaveBeenCalledOnce()
  })

  it('keeps navigation and tool slots plus account commands in the shared header', () => {
    const command = vi.fn()
    const view = mount(AppHeader, { username: 'fixture-user', userRoleLabel: '管理员', onCommand: command }, {
      center: () => h('nav', { 'aria-label': '平台空间切换' }, '主工作台'),
      tools: () => h('button', '平台 AI')
    })
    expect(view.nodes('nav')[0].props['aria-label']).toBe('平台空间切换')
    expect(view.nodes('button').map(text)).toContain('平台 AI')
    expect(view.nodes('span').map(text)).toContain('fixture-user')
    expect(view.nodes('ThemeSwitcher')).toHaveLength(1)
    expect(view.nodes('ElDropdownItem').map(node => node.props.command)).toEqual(['profile', 'changePassword', 'logout'])
    view.nodes('ElDropdown')[0].props.onCommand('profile')
    expect(command).toHaveBeenCalledExactlyOnceWith('profile')
  })

  it('preserves directory slots, splitter bounds and reactive list sizing without the retired toolbar', async () => {
    const state = reactive({ initialListWidth: 380, listMin: 320, listMax: 540, moduleClass: 'fixture-directory' })
    const view = mount(ManagerLayout, state, {
      list: () => h('h2', '列表'), detail: () => h('p', '详情'), default: () => h('dialog', '编辑')
    })
    expect(view.nodes('h2').map(text)).toEqual(['列表'])
    expect(view.nodes('p').map(text)).toEqual(['详情'])
    expect(view.nodes('dialog').map(text)).toEqual(['编辑'])
    expect(view.nodes('aside')[0].props.style.width).toBe('380px')
    expect(view.nodes('SplitterBar')[0].props).toMatchObject({ min: 320, max: 540, modelValue: 380 })
    view.nodes('SplitterBar')[0].props['onUpdate:modelValue'](420)
    await nextTick()
    expect(view.nodes('aside')[0].props.style.width).toBe('420px')
    state.initialListWidth = 350
    await nextTick()
    expect(view.nodes('aside')[0].props.style.width).toBe('350px')
    expect(view.nodes('SplitterBar')[0].props.modelValue).toBe(350)
  })

  it('keeps a semantic title, metadata and the original page action', () => {
    const action = vi.fn()
    const view = mount(PageHeader, { title: '成果库', icon: icons.folderOpened }, {
      meta: () => h('span', '3 项'),
      actions: () => h('button', { type: 'button', onClick: action }, '导入')
    })
    expect(view.nodes('h1').map(text)).toEqual(['成果库'])
    expect(view.nodes('span').map(text)).toContain('3 项')
    view.nodes('button')[0].props.onClick()
    expect(action).toHaveBeenCalledOnce()
  })

  it('preserves native quick-filter actions and the requested column count', () => {
    const filter = vi.fn()
    const view = mount(StatsStrip, { columns: 5 }, {
      default: () => h('button', { type: 'button', 'aria-pressed': false, onClick: filter }, '可运行 4')
    })
    expect(view.nodes('section')[0].props.style['--stats-columns']).toBe(5)
    view.nodes('button')[0].props.onClick()
    expect(filter).toHaveBeenCalledOnce()
  })

  it.each(['add', 'edit'])('keeps %s dialog cancellation separate from validated submission', async mode => {
    const submit = vi.fn()
    const visibility = vi.fn()
    validate.mockImplementation(callback => callback(true))
    const view = mount(PluginDialog, { modelValue: true, mode, onSubmit: submit, 'onUpdate:modelValue': visibility })
    const dialog = view.nodes('ElDialog')[0]
    expect(dialog.props.width).toBe('var(--dialog-width-lg)')
    expect(dialog.props['align-center']).toBe('')
    view.button('取消').props.onClick()
    expect(visibility).toHaveBeenCalledWith(false)
    expect(validate).not.toHaveBeenCalled()
    expect(submit).not.toHaveBeenCalled()
    view.button(mode === 'edit' ? '保存更改' : '创建插件').props.onClick()
    await nextTick()
    expect(validate).toHaveBeenCalledOnce()
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ version: '1.0.0' }))
  })

  it('retains form validation after moving confirmation into the dialog footer', () => {
    const submit = vi.fn()
    validate.mockImplementation(callback => callback(false))
    const view = mount(PluginDialog, { modelValue: true, onSubmit: submit })
    view.button('创建插件').props.onClick()
    expect(submit).not.toHaveBeenCalled()
    expect(warning).toHaveBeenCalledOnce()
  })

  it.each([
    ['matching', { effectiveContextWindowTokens: 1000, effectiveMaxOutputTokens: 100, capabilityRecognized: true }, false],
    ['overridden', { effectiveContextWindowTokens: 800, effectiveMaxOutputTokens: 100, capabilityRecognized: true }, true],
    ['unrecognized', { effectiveContextWindowTokens: 1000, effectiveMaxOutputTokens: 100, capabilityRecognized: false }, true]
  ])('keeps %s capability limits available and only collapses known duplicate values', (_label, limits, open) => {
    const view = mount(ModelDetail, { model: {
      id: 1, model: 'example-model', isActive: 1,
      capabilityContextWindowTokens: 1000, capabilityMaxOutputTokens: 100, ...limits
    } })
    expect(view.nodes('details')[0].props.open).toBe(open)
    expect(text(view.nodes('details')[0])).toContain('1,000')
  })
})
