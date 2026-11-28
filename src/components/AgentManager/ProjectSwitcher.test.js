import { expect, it, vi } from 'vitest'
import { h, nextTick } from 'vue'
import { compileClientComponent, createSlotStub, findNode, findNodes } from '@/test-support/vueComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import { ALL_PROJECTS_ID, UNASSIGNED_PROJECT_ID } from '@/composables/useProjectDirectory.js'
import { icons } from '@/utils/icons.js'

vi.mock('@/services/api/projects.js', () => ({ getProjectsApi: vi.fn() }))

const Switcher = compileClientComponent(new URL('./ProjectSwitcher.vue', import.meta.url), {
  '@iconify/vue': { Icon: { render: () => null } },
  '@/composables/useProjectDirectory.js': { ALL_PROJECTS_ID, UNASSIGNED_PROJECT_ID },
  '@/utils/icons.js': { icons }
})

it('focuses the search and switches only on an unambiguous Enter outside composition', async () => {
  const renderer = createTestRenderer()
  const select = vi.fn()
  const focusSearch = vi.fn()
  const activeProject = {
    projectId: 'current', projectName: 'Atlas', projectCode: 'AT-001',
    entryNodeCount: 3, activeSessionCount: 3, cacheSessionCount: 2, contentEditable: true
  }
  const app = renderer.createApp(Switcher, {
    modelValue: activeProject.projectId,
    activeProject,
    projects: [
      activeProject,
      { projectId: 'archived', projectName: 'Atlas Archive', projectCode: 'AT-002', status: 'archived' }
    ],
    'onUpdate:modelValue': select
  })
  app.component('ElPopover', createSlotStub('ElPopover', ['reference', 'default']))
  app.component('ElTooltip', createSlotStub('ElTooltip'))
  app.component('ElIcon', createSlotStub('ElIcon'))
  app.component('ElInput', {
    inheritAttrs: false,
    setup(_props, { attrs, expose }) {
      expose({ focus: focusSearch })
      return () => h('ElInput', attrs)
    }
  })
  app.mount(renderer.root)
  try {
    const findClass = name => findNodes(renderer.root, node => node.props.class === name)[0]
    const readText = node => [node.text, ...node.children.map(readText)].join('')
    const statsLabel = '3 个入口节点 · 1 个实时会话 · 2 个缓存会话'
    expect(readText(findClass('project-workspace__meta'))).toContain(statsLabel)
    expect(findNodes(renderer.root, node => node.type === 'small').map(readText))
      .toContain(`AT-001 · ${statsLabel}`)
    const trigger = findClass('project-trigger')
    trigger.focus = vi.fn()
    const popover = () => findNode(renderer.root, 'ElPopover').props
    const input = () => findNode(renderer.root, 'ElInput').props
    const search = value => input()['onUpdate:modelValue'](value)
    const keyEvent = (key, isComposing = false) => ({
      key, isComposing, preventDefault: vi.fn(), stopPropagation: vi.fn()
    })
    popover()['onUpdate:visible'](true)
    await nextTick()
    popover().onAfterEnter()
    expect(focusSearch).toHaveBeenCalledOnce()

    search('Atlas')
    input().onKeydown(keyEvent('Enter'))
    search('at-002')
    input().onKeydown(keyEvent('Enter', true))
    expect(select).not.toHaveBeenCalled()
    expect(popover().visible).toBe(true)

    input().onKeydown(keyEvent('Enter'))
    expect(select).toHaveBeenCalledExactlyOnceWith('archived')
    await nextTick()
    expect(popover().visible).toBe(false)
    expect(input().modelValue).toBe('')
    expect(trigger.focus).toHaveBeenCalledOnce()

    popover()['onUpdate:visible'](true)
    await nextTick()
    findClass('project-picker').props.onKeydown(keyEvent('Escape'))
    await nextTick()
    expect(popover().visible).toBe(false)
    expect(trigger.focus).toHaveBeenCalledTimes(2)
  } finally {
    app.unmount()
  }
})
