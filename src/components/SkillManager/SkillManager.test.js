import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { compileClientComponent, createSlotStub, findNodes } from '@/test-support/vueComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import { useSkillCatalog } from './useSkillCatalog.js'
import { useSkillWorkspace } from './useSkillWorkspace.js'
import { useSkillBatchActions } from './useSkillBatchActions.js'
import { useSkillFilters } from './useSkillFilters.js'
import * as model from './skillUiModel.js'
import * as serializer from './skillManifestSerializer.js'

const mocks = vi.hoisted(() => ({
  api: Object.fromEntries(['listSkillsApi', 'getSkillTaxonomyApi', 'getSkillHealthApi', 'searchSkillsApi', 'listSkillFilesApi',
    'getSkillFileApi', 'deleteSkillApi', 'deleteSkillsBatchApi', 'exportSkillApi', 'exportSkillsBatchApi', 'saveSkillApi',
    'toggleSkillApi', 'toggleSkillsBatchApi'].map(name => [name, vi.fn()])),
  confirm: vi.fn(), error: vi.fn(), success: vi.fn(), warning: vi.fn()
}))
vi.mock('@/services/api/skills.js', () => mocks.api)
vi.mock('@/utils/confirmUtils.js', () => ({ confirmAction: mocks.confirm }))
vi.mock('@/utils/messageUtils.js', () => ({ showError: mocks.error, showWarning: mocks.warning }))
const uiState = ref({ activeScope: 'agent-node', catalogMode: 'simple', treePanelWidth: 240, lastFilePath: '' })
const admin = ref(true)
const stub = createSlotStub
const childModules = Object.fromEntries(['SkillEditorDialog', 'SkillFileTree', 'SkillFileEditor', 'ImportSkillDialog',
  'SkillAvailabilityTag', 'SkillManifestEditorDialog', 'SkillIssueDrawer', 'SkillHealthDialog', 'SkillBatchResultDialog']
  .map(name => [`./${name}.vue`, { default: stub(name) }]))
const CatalogTable = compileClientComponent(new URL('./SkillCatalogTable.vue', import.meta.url), {
  '@iconify/vue': { Icon: stub('Icon') }, '@/utils/icons.js': { icons: {} },
  './SkillAvailabilityTag.vue': { default: stub('SkillAvailabilityTag') }, './skillUiModel.js': model
})
const CatalogFilters = compileClientComponent(new URL('./SkillCatalogFilters.vue', import.meta.url), {
  '@iconify/vue': { Icon: stub('Icon') }
})
const WorkspaceOverview = compileClientComponent(new URL('./SkillWorkspaceOverview.vue', import.meta.url))
const Manager = compileClientComponent(new URL('./SkillManager.vue', import.meta.url), {
  ...childModules,
  './SkillCatalogTable.vue': { default: CatalogTable },
  './SkillCatalogFilters.vue': { default: CatalogFilters },
  './SkillWorkspaceOverview.vue': { default: WorkspaceOverview },
  './useSkillFilters.js': { useSkillFilters },
  '@/components/common/StatsStrip.vue': { default: stub('StatsStrip') },
  '@/components/common/PageHeader.vue': { default: stub('PageHeader', ['default', 'actions']) },
  '@/components/common/BatchActionBar.vue': { default: stub('BatchActionBar') },
  '@/components/common/SplitterBar.vue': { default: stub('SplitterBar') },
  '@iconify/vue': { Icon: stub('Icon') }, '@/utils/icons.js': { icons: {} },
  '@/services/api/skills.js': mocks.api,
  '@/utils/apiUtils.js': { executeRequest: async (request, options = {}) => { const result = await request(); await options.onSuccess?.(result); return result } },
  '@/utils/confirmUtils.js': { confirmAction: mocks.confirm, executeDeleteWithConfirm: async (request, options = {}) => {
    const result = await request(); await options.onSuccess?.(result); return result
  } },
  '@/utils/messageUtils.js': { showError: mocks.error, showSuccess: mocks.success, showWarning: mocks.warning },
  '@/utils/exportUtils.js': { executeBlobDownload: request => request() },
  '@/composables/useAuth.js': { useAuth: () => ({ isAdmin: admin }) },
  './useSkillBatchActions.js': { useSkillBatchActions },
  './useSkillUiState.js': { useSkillUiState: () => ({ state: uiState }) },
  './useSkillCatalog.js': { useSkillCatalog }, './useSkillWorkspace.js': { useSkillWorkspace },
  './skillManifestSerializer.js': serializer, './skillUiModel.js': model
})
const alpha = { name: 'alpha', valid: true, enabled: true, status: 'published', issues: [], description: 'fixture',
  category: 'discovery', platforms: ['linux'], domain: 'operation', risk: 'low', accessMode: 'read-only' }
const apps = []
const text = node => [node.text, ...node.children.map(text)].join('')
async function flush() { for (let i = 0; i < 6; i++) { await Promise.resolve(); await nextTick() } }
async function mount() {
  const renderer = createTestRenderer(), app = renderer.createApp(Manager)
  for (const name of ['ElSegmented', 'ElButton', 'ElDropdown', 'ElBadge', 'ElIcon', 'ElInput', 'ElPopover', 'ElSelect',
    'ElOption', 'ElCheckbox', 'ElTag', 'ElTooltip', 'ElTable', 'ElEmpty', 'ElAlert', 'ElTabs', 'ElTabPane',
    'ElDescriptions', 'ElDescriptionsItem'])
    app.component(name, stub(name))
  app.component('ElTableColumn', defineComponent({
    inheritAttrs: false,
    setup(_props, { attrs, slots }) { return () => h('ElTableColumn', attrs, slots.default?.({ row: alpha })) }
  }))
  app.directive('loading', {})
  app.mount(renderer.root); apps.push(app)
  await flush()
  return {
    app, nodes: name => findNodes(renderer.root, node => node.type === name), text: () => text(renderer.root),
    buttons: className => findNodes(renderer.root, node => node.type === 'button' && String(node.props.class).includes(className))
  }
}
beforeEach(() => {
  vi.resetAllMocks()
  admin.value = true
  uiState.value = { activeScope: 'agent-node', catalogMode: 'simple', treePanelWidth: 240, lastFilePath: '' }
  mocks.api.listSkillsApi.mockResolvedValue({ data: [alpha] })
  mocks.api.getSkillTaxonomyApi.mockResolvedValue({ data: {} })
  mocks.api.listSkillFilesApi.mockResolvedValue({ data: [{ path: 'SKILL.md' }, { path: 'manifest.yaml' }] })
  mocks.api.getSkillFileApi.mockResolvedValue({ data: { content: 'fixture content', size: 15 } })
  mocks.api.getSkillHealthApi.mockResolvedValue({ data: { skills: [alpha] } })
  mocks.api.toggleSkillsBatchApi.mockResolvedValue({ data: { changed: 0, failed: 1, results: [{ name: 'alpha', status: 'failed' }] } })
  mocks.api.exportSkillApi.mockResolvedValue({ data: new Blob(['fixture']) })
  mocks.api.deleteSkillApi.mockResolvedValue({})
  mocks.confirm.mockResolvedValue(true)
})
afterEach(() => { for (const app of apps.splice(0)) app.unmount() })

describe('SkillManager composed workflows', () => {
  it.each([['catalog', 'export'], ['workspace', 'export'], ['catalog', 'delete'], ['workspace', 'delete']])(
    'routes %s %s through the same Skill command without consuming widget metadata as the target', async (mode, command) => {
      const view = await mount()
      if (mode === 'workspace') {
        await view.nodes('ElTable')[0].props.onRowDblclick(alpha); await flush()
      }
      const menu = view.nodes('ElDropdown').find(node => findNodes(node,
        child => child.props?.['aria-label'] === '更多 Skill 操作').length)
      await menu.props.onCommand(command, { dropdownItem: true }); await flush()
      if (command === 'export') expect(mocks.api.exportSkillApi).toHaveBeenCalledExactlyOnceWith('agent-node', 'alpha')
      else {
        expect(mocks.api.deleteSkillApi).toHaveBeenCalledExactlyOnceWith({ scope: 'agent-node', name: 'alpha' })
        expect(view.nodes('SkillFileEditor')).toHaveLength(0)
      }
    }
  )

  it('invalidates batch selection even when a changed filter leaves the same row visible', async () => {
    const view = await mount()
    view.nodes('ElTable')[0].props.onSelectionChange([alpha]); await flush()
    expect(view.nodes('BatchActionBar')[0].props.count).toBe(1)
    const category = view.nodes('ElSelect').find(node => node.props.placeholder === '全部分类')
    category.props['onUpdate:modelValue']('discovery'); await flush()
    expect(view.nodes('ElTable')[0].props.data).toEqual([alpha])
    expect(view.nodes('BatchActionBar')[0].props.count).toBe(0)
  })

  it('composes filter changes, active chips and individual removal', async () => {
    const view = await mount()
    const category = view.nodes('ElSelect').find(node => node.props.placeholder === '全部分类')
    category.props['onUpdate:modelValue']('collection'); await flush()
    expect(view.nodes('ElTable')[0].props.data).toEqual([])
    const chip = view.nodes('ElTag').find(node => Object.hasOwn(node.props, 'closable'))
    expect(text(chip)).toContain('collection')
    chip.props.onClose(); await flush()
    expect(view.nodes('ElTable')[0].props.data).toEqual([alpha])
  })

  it('preserves a new selection when a select widget echoes its unchanged controlled value', async () => {
    const view = await mount()
    const category = view.nodes('ElSelect').find(node => node.props.placeholder === '全部分类')
    category.props['onUpdate:modelValue']('discovery'); await flush()
    view.nodes('ElTable')[0].props.onSelectionChange([alpha]); await flush()
    category.props['onUpdate:modelValue']('discovery'); await flush()
    expect(view.nodes('BatchActionBar')[0].props.count).toBe(1)
  })

  it('projects governance filters back to visible simple-mode criteria when admin capability changes', async () => {
    uiState.value = { ...uiState.value, catalogMode: 'governance' }
    const view = await mount()
    const domain = view.nodes('ElSelect').find(node => node.props.placeholder === '全部能力域')
    const category = view.nodes('ElSelect').find(node => node.props.placeholder === '全部分类')
    domain.props['onUpdate:modelValue']('operation')
    category.props['onUpdate:modelValue']('discovery'); await flush()
    admin.value = false; await flush()
    expect(view.nodes('ElSelect').some(node => node.props.placeholder === '全部能力域')).toBe(false)
    expect(view.nodes('ElSelect').find(node => node.props.placeholder === '全部分类').props['model-value']).toBe('discovery')
    expect(view.nodes('ElTag').filter(node => Object.hasOwn(node.props, 'closable')).map(text)).toHaveLength(1)
    expect(view.nodes('ElTable')[0].props.data).toEqual([alpha])
  })

  it('composes overview edit events while respecting read-only rendering', async () => {
    const view = await mount()
    await view.nodes('ElTable')[0].props.onRowDblclick(alpha); await flush()
    const overview = view.nodes('div').find(node => node.props.class === 'overview-scroll')
    const edit = findNodes(overview, node => node.type === 'ElButton')[0]
    edit.props.onClick(); await flush()
    expect(view.nodes('SkillManifestEditorDialog')[0].props.modelValue).toBe(true)
    admin.value = false; await flush()
    expect(findNodes(overview, node => node.type === 'ElButton')).toHaveLength(0)
  })

  it('controls selection and select-all/clear through row models, not widget refs', async () => {
    const view = await mount()
    view.nodes('ElTable')[0].props.onSelectionChange([alpha]); await flush()
    expect(view.nodes('BatchActionBar')[0].props.count).toBe(1)
    view.nodes('BatchActionBar')[0].props.onClear(); await flush()
    expect(view.nodes('BatchActionBar')[0].props.count).toBe(0)
    view.nodes('BatchActionBar')[0].props.onToggleAll(true); await flush()
    expect(view.nodes('BatchActionBar')[0].props.count).toBe(1)
    view.nodes('BatchActionBar')[0].props.onToggleAll(false); await flush()
    expect(view.nodes('BatchActionBar')[0].props.count).toBe(0)
  })

  it('composes batch submission, failed-selection restoration and result navigation', async () => {
    const view = await mount()
    view.nodes('ElTable')[0].props.onSelectionChange([alpha]); await flush()
    const bar = view.nodes('BatchActionBar')[0]
    const disable = findNodes(bar, node => node.type === 'ElButton' && text(node).trim() === '禁用')[0]
    await disable.props.onClick(); await flush()
    expect(mocks.api.toggleSkillsBatchApi).toHaveBeenCalledWith({ scope: 'agent-node', names: ['alpha'], enabled: false })
    expect(view.nodes('BatchActionBar')[0].props.count).toBe(1)
    expect(view.nodes('SkillBatchResultDialog')[0].props.data.failed).toBe(1)
    expect(view.nodes('SkillBatchResultDialog')[0].props.modelValue).toBe(true)
    await view.nodes('SkillBatchResultDialog')[0].props.onLocate('alpha'); await flush()
    expect(view.nodes('SkillBatchResultDialog')[0].props.modelValue).toBe(false)
    expect(view.nodes('SkillIssueDrawer')[0].props.modelValue).toBe(true)
  })

  it('clears the controlled selection when the catalog scope changes', async () => {
    const view = await mount()
    view.nodes('BatchActionBar')[0].props.onToggleAll(true); await flush()
    view.buttons('scope-tab')[1].props.onClick(); await flush()
    expect(view.nodes('BatchActionBar')[0].props.count).toBe(0)
    expect(uiState.value.activeScope).toBe('platform')
  })

  it('loads both catalog scopes and wires file selection and metadata refresh through the workspace', async () => {
    const view = await mount()
    expect(mocks.api.listSkillsApi).toHaveBeenCalledWith('agent-node')
    expect(mocks.api.listSkillsApi).toHaveBeenCalledWith('platform')
    await view.nodes('ElTable')[0].props.onRowDblclick(alpha)
    await flush()
    expect(view.nodes('SkillFileTree')[0].props['skill-name']).toBe('alpha')
    expect(view.nodes('SkillFileEditor')[0].props['file-content']).toBe('fixture content')
    view.nodes('SplitterBar')[0].props['onUpdate:modelValue'](310); await flush()
    expect(uiState.value.treePanelWidth).toBe(310)
    expect(view.nodes('SkillFileTree')[0].props.style.width).toBe('310px')
    uiState.value.treePanelWidth = 280; await flush()
    expect(view.nodes('SplitterBar')[0].props.modelValue).toBe(280)
    await view.nodes('SkillFileTree')[0].props.onSelect('manifest.yaml')
    await flush()
    expect(view.nodes('SkillFileEditor')[0].props['file-path']).toBe('manifest.yaml')
    await view.nodes('SkillFileEditor')[0].props.onSaved({ path: 'manifest.yaml' })
    expect(mocks.api.listSkillsApi).toHaveBeenCalledTimes(3)
    expect(uiState.value.treePanelWidth).toBe(280)
  })

  it('keeps the workspace open when dirty changes are not discarded', async () => {
    const view = await mount()
    await view.nodes('ElTable')[0].props.onRowDblclick(alpha)
    await flush()
    view.nodes('SkillFileEditor')[0].props.onDirtyChange(true)
    mocks.confirm.mockResolvedValue(false)
    const back = view.nodes('ElButton').find(node => node.props['aria-label'] === '返回能力目录')
    await back.props.onClick(); await flush()
    expect(view.nodes('SkillFileEditor')).toHaveLength(1)
    mocks.confirm.mockResolvedValue(true)
    await back.props.onClick(); await flush()
    expect(view.nodes('SkillFileEditor')).toHaveLength(0)
    expect(view.nodes('ElTable')).toHaveLength(1)
  })

  it('composes health feedback and issue navigation without handing presenters API responsibilities', async () => {
    const view = await mount()
    await view.nodes('ElDropdown')[0].props.onCommand('health')
    await flush()
    expect(view.nodes('SkillHealthDialog')[0].props.modelValue).toBe(true)
    await view.nodes('SkillHealthDialog')[0].props.onLocate(alpha)
    await flush()
    expect(view.nodes('SkillHealthDialog')[0].props.modelValue).toBe(false)
    expect(view.nodes('SkillIssueDrawer')[0].props.modelValue).toBe(true)
    const issue = { field: 'manifest.name', severity: 'ERROR' }
    await view.nodes('SkillIssueDrawer')[0].props.onOpenFile(issue)
    await flush()
    expect(view.nodes('ElTabs')[0].props.modelValue).toBe('files')
    expect(view.nodes('SkillIssueDrawer')[0].props.modelValue).toBe(false)
    expect(mocks.api.getSkillFileApi).toHaveBeenLastCalledWith('agent-node', 'alpha', model.issueTargetFile(issue))
  })

  it('updates the selected scope and closes feedback for the previous catalog', async () => {
    const view = await mount()
    await view.nodes('ElDropdown')[0].props.onCommand('health')
    view.buttons('scope-tab')[1].props.onClick(); await flush()
    expect(uiState.value.activeScope).toBe('platform')
    expect(view.nodes('SkillHealthDialog')[0].props.modelValue).toBe(false)
    await view.nodes('ElTable')[0].props.onRowDblclick(alpha)
    expect(mocks.api.listSkillFilesApi).toHaveBeenLastCalledWith('platform', 'alpha')
  })
})
