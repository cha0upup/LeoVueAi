/* eslint-disable vue/one-component-per-file -- Fixture components render the real dialog templates. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import * as Vue from 'vue'
import { readFileSync } from 'node:fs'
import { compileScript, parse } from '@vue/compiler-sfc'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import { icons } from '@/utils/icons.js'
import { useDialog } from '@/utils/dialogUtils.js'
import { executeRequest } from '@/utils/apiUtils.js'
import { useAgentForm } from '@/composables/useAgentForm.js'

const mocks = vi.hoisted(() => ({
  add: vi.fn(), update: vi.fn(), validate: vi.fn(),
  resetFields: vi.fn(), clearValidate: vi.fn(), scrollToTop: vi.fn(),
  showError: vi.fn(), showSuccess: vi.fn(), showInfo: vi.fn(), showWarning: vi.fn()
}))
vi.mock('@/services/api/agent-manage.js', () => ({
  addAgentApi: mocks.add, updateAgentApi: mocks.update, probeUrlPathsApi: vi.fn()
}))
vi.mock('@/services/api/disguises.js', () => ({ getDisguisesApi: vi.fn().mockResolvedValue({ data: [] }) }))
vi.mock('@/services/api/agent-node.js', () => ({ testAgentConnectionConfigApi: vi.fn() }))
vi.mock('@/utils/messageUtils.js', () => mocks)

const AgentFormFields = defineComponent({
  inheritAttrs: false,
  props: {
    agent: Object,
    proxyEnabled: Boolean,
    paddingEnabled: Boolean,
    paddingPreset: String,
    paddingForm: Object
  },
  setup(props, { attrs, expose }) {
    expose({
      validate: mocks.validate, resetFields: mocks.resetFields,
      clearValidate: mocks.clearValidate, scrollToTop: mocks.scrollToTop
    })
    return () => h('AgentFormFields', { ...props, ...attrs })
  }
})
const ParentHostSummary = defineComponent({
  setup(_props, { attrs }) {
    return () => h('ParentHostSummary', attrs)
  }
})
const modules = {
  vue: Vue,
  '@/utils/icons.js': { icons },
  '@/utils/dialogUtils.js': { useDialog },
  '@/utils/apiUtils.js': { executeRequest },
  '@/composables/useAgentForm.js': { useAgentForm },
  '@/services/api/agent-manage.js': { addAgentApi: mocks.add, updateAgentApi: mocks.update },
  './AgentFormFields.vue': { default: AgentFormFields },
  './AgentConnectionResultBanner.vue': { default: { render: () => null } },
  './ParentHostSummary.vue': { default: ParentHostSummary }
}

// Compile the actual client templates: Vitest's default Node transform emits SSR components.
const compileDialog = (name) => {
  const { descriptor } = parse(readFileSync(new URL(`./${name}.vue`, import.meta.url), 'utf8'))
  const compiled = compileScript(descriptor, { id: `${name}-test`, inlineTemplate: true }).content
    .replace(/^import\s+(\{[^}]+\}|\w+)\s+from\s+['"]([^'"]+)['"];?$/gm, (_line, names, path) => {
      if (!modules[path]) throw new Error(`Unexpected dialog import: ${path}`)
      const binding = names.startsWith('{') ? names.replace(/\s+as\s+/g, ': ') : `{ default: ${names} }`
      return `const ${binding} = modules[${JSON.stringify(path)}]`
    })
    .replace('export default', 'return')
  return new Function('modules', compiled)(modules)
}
const AddAgent = compileDialog('AddAgent')
const EditAgent = compileDialog('EditAgent')
const findNode = (node, type) => {
  if (node.type === type) return node
  for (const child of node.children) {
    const found = findNode(child, type)
    if (found) return found
  }
  return null
}

describe('Agent dialog shared form integration', () => {
  const apps = []
  const mountDialog = (component) => {
    const renderer = createTestRenderer()
    const refresh = vi.fn()
    const app = renderer.createApp(component, { projectId: 'project-1', onRefresh: refresh })
    for (const name of ['ElDialog', 'ElButton', 'ElIcon', 'Icon']) {
      app.component(name, defineComponent({
        inheritAttrs: false,
        setup(_props, { attrs, slots }) {
          return () => h(name, attrs, [slots.header?.(), slots.default?.(), slots.footer?.()])
        }
      }))
    }
    const vm = app.mount(renderer.root)
    apps.push(app)
    return { vm, refresh, node: type => findNode(renderer.root, type) }
  }
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.validate.mockResolvedValue(true)
    mocks.add.mockResolvedValue({ data: {} })
    mocks.update.mockResolvedValue({ data: {} })
  })
  afterEach(() => {
    for (const app of apps.splice(0)) app.unmount()
  })

  it('adds the current form with project context and resets it after success', async () => {
    const dialog = mountDialog(AddAgent)
    dialog.vm.openAddAgent()
    await nextTick()
    const fields = dialog.node('AgentFormFields')
    Object.assign(fields.props.agent, { agentName: 'new node', headers: 'X-Token: value' })
    fields.props['onUpdate:proxyEnabled'](true)
    fields.props['onUpdate:paddingEnabled'](true)
    fields.props.onApplyPaddingPreset('light')
    await nextTick()
    await fields.props.onSubmit()
    await nextTick()

    expect(mocks.add).toHaveBeenCalledWith(expect.objectContaining({
      agentName: 'new node', proxyEnabled: 1, headers: '{"X-Token":"value"}',
      paddingStrategy: '{"enabled":true,"lengthDistribution":"UNIFORM","minBytes":16,"maxBytes":128}'
    }), { projectId: 'project-1' })
    expect(dialog.refresh).toHaveBeenCalledOnce()
    expect(dialog.node('ElDialog').props.modelValue).toBe(false)
    expect(fields.props.agent.agentName).toBe('')
    expect(dialog.node('AgentFormFields').props.proxyEnabled).toBe(false)
  })

  it('edits stored configuration and clears parent context when closed', async () => {
    const dialog = mountDialog(EditAgent)
    const saved = { agentId: 'node-1', agentName: 'old node', headers: '{"X-Token":"value"}', proxyEnabled: '1' }
    const parent = { host: { hostId: 'host-1' }, status: 'online', label: '在线' }
    dialog.vm.openEditAgentDialog(saved, parent)
    await nextTick()
    const fields = dialog.node('AgentFormFields')
    expect(fields.props.proxyEnabled).toBe(true)
    expect(fields.props.agent.headers).toBe('X-Token: value')
    expect(dialog.node('ParentHostSummary').props.host).toEqual(parent.host)
    fields.props.agent.agentName = 'updated node'
    await fields.props.onSubmit()
    await nextTick()

    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      agentId: 'node-1', agentName: 'updated node', headers: saved.headers, proxyEnabled: 1
    }))
    expect(saved.agentName).toBe('old node')
    expect(dialog.refresh).toHaveBeenCalledOnce()
    expect(dialog.node('ElDialog').props.modelValue).toBe(false)
    expect(dialog.node('ParentHostSummary')).toBeNull()
  })

  it.each([['add', AddAgent], ['edit', EditAgent]])('stops %s submission on invalid input', async (_name, component) => {
    const dialog = mountDialog(component)
    mocks.validate.mockResolvedValue(false)
    await dialog.node('AgentFormFields').props.onSubmit()
    expect(mocks.add).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
    expect(dialog.refresh).not.toHaveBeenCalled()
  })
})
