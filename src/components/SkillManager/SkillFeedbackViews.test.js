import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, reactive, ref } from 'vue'
import { readFileSync } from 'node:fs'
import { compileStyle, parse } from '@vue/compiler-sfc'
import { compileClientComponent, createSlotStub, findNodes } from '@/test-support/vueComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import * as model from './skillUiModel.js'

const Health = compileClientComponent(new URL('./SkillHealthDialog.vue', import.meta.url), { './skillUiModel.js': model })
const Batch = compileClientComponent(new URL('./SkillBatchResultDialog.vue', import.meta.url))
const Overview = compileClientComponent(new URL('./SkillWorkspaceOverview.vue', import.meta.url))
const Issues = compileClientComponent(new URL('./SkillIssueDrawer.vue', import.meta.url), {
  '@iconify/vue': { Icon: createSlotStub('Icon') }, './skillUiModel.js': model
})
const apps = []
const text = node => [node.text, ...node.children.map(text)].join('').trim()
function mount(component, initialProps = {}, initialRow = {}) {
  const props = reactive({ modelValue: true, ...initialProps }), row = ref(initialRow), events = []
  const renderer = createTestRenderer()
  const app = renderer.createApp({ setup: () => () => h(component, {
    ...props,
    'onUpdate:modelValue': value => { props.modelValue = value },
    onLocate: value => events.push(['locate', value]),
    onOpenFile: value => events.push(['open-file', value]),
    onRevalidate: () => events.push(['revalidate']),
    onEditConfig: () => events.push(['edit-config'])
  }) })
  for (const name of ['ElDialog', 'ElDrawer', 'ElButton', 'ElTable', 'ElTag', 'ElDescriptions', 'ElDescriptionsItem']) app.component(name, createSlotStub(name))
  app.component('ElTableColumn', defineComponent({
    inheritAttrs: false,
    setup(_props, { attrs, slots }) { return () => h('ElTableColumn', attrs, slots.default?.({ row: row.value })) }
  }))
  app.mount(renderer.root); apps.push(app)
  return {
    props, row, events,
    nodes: type => findNodes(renderer.root, node => node.type === type),
    text: () => text(renderer.root)
  }
}
afterEach(() => { for (const app of apps.splice(0)) app.unmount() })

describe('Skill feedback presentation contracts', () => {
  it.each([['health', Health, 'ElDialog'], ['batch', Batch, 'ElDialog'], ['issues', Issues, 'ElDrawer']])(
    'keeps %s visibility controlled by its parent in both directions', async (_name, component, host) => {
      const view = mount(component)
      expect(view.nodes(host)[0].props.modelValue).toBe(true)
      view.props.modelValue = false; await nextTick()
      expect(view.nodes(host)[0].props.modelValue).toBe(false)
      view.props.modelValue = true; await nextTick()
      expect(view.nodes(host)[0].props.modelValue).toBe(true)
      view.nodes(host)[0].props['onUpdate:modelValue'](false)
      expect(view.props.modelValue).toBe(false)
    }
  )

  it('derives health counts and preserves scoped rows, status labels and locate events', async () => {
    const rows = [{ name: 'healthy', valid: true }, { name: 'warning', valid: true, issues: [{ severity: 'warning' }] }, { name: 'invalid', valid: false, issues: [{ severity: 'WARNING' }] }]
    const view = mount(Health, { scope: 'agent-node', data: { skills: rows } }, rows[1])
    expect(view.nodes('strong').map(text)).toEqual(['1', '1', '1'])
    expect(view.text()).toContain('共检查 3 个 agent-node Skill')
    expect(view.nodes('ElTable')[0].props.data).toEqual(rows)
    expect(view.nodes('ElTag')[0].props.type).toBe('warning')
    view.nodes('ElButton')[0].props.onClick()
    expect(view.events).toEqual([['locate', rows[1]]])
    view.row.value = rows[2]; await nextTick()
    expect(view.nodes('ElTag')[0].props.type).toBe('danger')
    expect(view.text()).toContain('错误')
  })

  it('reacts to refreshed health props without mutating its input', async () => {
    const data = { skills: [] }, view = mount(Health, { data })
    view.props.data = { skills: [{ valid: true }] }; await nextTick()
    expect(view.nodes('strong').map(text)).toEqual(['1', '0', '0'])
    expect(data).toEqual({ skills: [] })
    view.nodes('ElDialog')[0].props['onUpdate:modelValue'](false)
    expect(view.props.modelValue).toBe(false)
  })

  it('locates only failed batch rows that still exist in the current catalog', async () => {
    const row = { name: 'alpha', status: 'failed', message: 'fixture failure' }
    const view = mount(Batch, { title: '批量启用结果', data: { changed: 2, unchanged: 1, failed: 1, results: [row] }, availableNames: ['alpha'] }, row)
    expect(view.nodes('ElDialog')[0].props.title).toBe('批量启用结果')
    expect(view.text()).toContain('已变更 2')
    expect(view.text()).toContain('未变更 1')
    expect(view.text()).toContain('失败 1')
    view.nodes('ElButton')[0].props.onClick()
    expect(view.events).toEqual([['locate', 'alpha']])
    view.props.availableNames = []; await nextTick()
    expect(view.nodes('ElButton')).toHaveLength(0)
  })

  it('preserves deleted/unchanged/unknown batch result labels and hides locate for successes', async () => {
    const view = mount(Batch, { availableNames: ['alpha'] }, { name: 'alpha', status: 'deleted' })
    expect(view.text()).toContain('已删除')
    expect(view.nodes('ElButton')).toHaveLength(0)
    view.row.value = { name: 'alpha', status: 'unchanged' }; await nextTick()
    expect(view.text()).toContain('未变更')
    view.row.value = { name: 'alpha', status: 'other' }; await nextTick()
    expect(view.text()).toContain('other')
    view.nodes('ElDialog')[0].props['onUpdate:modelValue'](false)
    expect(view.props.modelValue).toBe(false)
  })

  it('keeps issue navigation and revalidation as explicit parent-owned events', () => {
    const issue = { severity: 'ERROR', field: 'manifest.name', message: 'fixture issue' }
    const view = mount(Issues, { skill: { name: 'alpha', valid: false, issues: [issue] } })
    expect(view.text()).toContain('错误 1 · 警告 0')
    expect(view.text()).toContain('fixture issue')
    expect(view.text()).toContain(`打开 ${model.issueTargetFile(issue)}`)
    view.nodes('button')[0].props.onClick()
    view.nodes('ElButton')[0].props.onClick()
    expect(view.events).toEqual([['open-file', issue], ['revalidate']])
    expect(view.nodes('ElDrawer')[0].props.size).toBe('520px')
  })

  it('renders the existing no-issues state and forwards drawer close without changing the skill', () => {
    const skill = { name: 'alpha', valid: true, issues: [] }, view = mount(Issues, { skill })
    expect(view.text()).toContain('没有发现校验问题')
    expect(view.nodes('button')).toHaveLength(0)
    view.nodes('ElDrawer')[0].props['onUpdate:modelValue'](false)
    expect(view.props.modelValue).toBe(false)
    expect(skill).toEqual({ name: 'alpha', valid: true, issues: [] })
  })
})

describe('Skill workspace overview presenter', () => {
  it('preserves simple-mode description and missing-metadata fallbacks', () => {
    const view = mount(Overview)
    expect(view.text()).toContain('暂无说明，请编辑 SKILL.md')
    expect(view.text()).toContain('未分类')
    expect(view.text()).toContain('unknown')
    expect(view.nodes('ElDescriptions')).toHaveLength(0)
    expect(view.nodes('ElButton')).toHaveLength(0)
  })

  it('renders descriptions as text and never mutates its Skill input', () => {
    const skill = { name: 'alpha', description: '<script>fixture</script>', category: 'discovery', platforms: ['linux', 'windows'], risk: 'low', accessMode: 'read-only' }
    const view = mount(Overview, { skill })
    expect(view.text()).toContain('<script>fixture</script>')
    expect(view.nodes('script')).toHaveLength(0)
    expect(view.text()).toContain('linux、windows')
    expect(skill.description).toBe('<script>fixture</script>')
  })

  it('delegates editing only for administrators and reacts to role changes', async () => {
    const view = mount(Overview, { isAdmin: true, skill: { name: 'alpha' } })
    view.nodes('ElButton')[0].props.onClick()
    expect(view.events).toEqual([['edit-config']])
    view.props.isAdmin = false; await nextTick()
    expect(view.nodes('ElButton')).toHaveLength(0)
  })

  it('preserves governance metadata and all four declaration groups', () => {
    const skill = { id: 'leo.alpha', owner: 'team', source: 'custom', domain: 'operation', category: 'discovery', pack: 'base', mode: 'guided', risk: 'low', accessMode: 'read-only',
      platforms: ['linux'], targets: ['host'], tactics: ['TA0001'], techniques: ['T0001'], requiredTools: ['tool'], requiredSkills: ['skill'], requiredFacts: ['fact'], produces: ['report'], next: ['next'] }
    const view = mount(Overview, { mode: 'governance', skill })
    expect(view.nodes('ElDescriptions')[0].props.column).toBe(3)
    expect(view.nodes('ElDescriptionsItem')).toHaveLength(9)
    expect(view.text()).toContain('leo.alpha')
    expect(view.nodes('h2').map(text)).toEqual(['使用说明', '治理信息', '平台与目标', 'ATT&CK 映射', '运行依赖', '产出与后续'])
    expect(view.nodes('ElTag').map(text)).toEqual(['linux', 'host', 'TA0001', 'T0001', 'tool', 'skill', 'fact', 'report', 'next'])
  })

  it('keeps undeclared groups visible and updates when the selected Skill changes', async () => {
    const view = mount(Overview, { mode: 'governance', skill: { description: 'first' } })
    expect(view.nodes('span').filter(node => node.props.class === 'empty-value')).toHaveLength(9)
    view.props.skill = { description: 'second', platforms: ['macos'] }; await nextTick()
    expect(view.text()).toContain('second')
    expect(view.text()).not.toContain('first')
    expect(view.nodes('ElTag').map(text)).toEqual(['macos'])
    view.props.mode = 'simple'; await nextTick()
    expect(view.nodes('ElTag')).toHaveLength(0)
    expect(view.nodes('ElDescriptions')).toHaveLength(0)
  })

  it('owns its scoped scrolling and responsive layout rules', () => {
    const { descriptor } = parse(readFileSync(new URL('./SkillWorkspaceOverview.vue', import.meta.url), 'utf8'))
    expect(descriptor.styles[0].scoped).toBe(true)
    const result = compileStyle({ source: descriptor.styles[0].content, id: 'overview-layout', scoped: false })
    expect(result.errors).toEqual([])
    const rules = []; result.rawResult.root.walkRules(rule => rules.push(rule))
    expect(rules.some(rule => rule.selector === '.overview-scroll' && rule.nodes.some(node => node.prop === 'overflow' && node.value === 'auto'))).toBe(true)
    expect(rules.some(rule => rule.selector === '.overview-grid' && rule.parent.params === '(max-width: 900px)' && rule.nodes.some(node => node.prop === 'grid-template-columns' && node.value === '1fr'))).toBe(true)
    expect(descriptor.styles[0].content).not.toContain(':deep(')
  })
})
