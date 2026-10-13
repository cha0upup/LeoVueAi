import { defineComponent, h } from 'vue'
import * as Vue from 'vue'
import { compileTestComponent, findNode } from '@/test-support/vueComponent.js'
import { describe, expect, it, vi } from 'vitest'
import { createTestRenderer } from '../../test-support/vueRenderer.js'
import { icons } from '@/utils/icons.js'

const modules = { vue: Vue, '@/utils/icons.js': { icons } }
const AgentHeroActions = compileTestComponent(new URL('./AgentHeroActions.vue', import.meta.url), modules, 'agent-hero-actions-test')

describe('AgentHeroActions semantic events', () => {
  it('emits child-node creation and preserves the other session commands', () => {
    const renderer = createTestRenderer()
    const agent = { agentId: 'node-1', agentName: 'Java node' }
    const onAddChildAgent = vi.fn()
    const onNewSession = vi.fn()
    const app = renderer.createApp(AgentHeroActions, {
      agent, liveSessionCount: 1, onAddChildAgent, onNewSession
    })
    for (const name of ['ElButton', 'ElDropdown', 'ElDropdownMenu', 'ElDropdownItem', 'ElIcon', 'Icon']) {
      app.component(name, defineComponent({
        inheritAttrs: false,
        setup(_props, { attrs, slots }) {
          return () => h(name, attrs, [slots.default?.(), slots.dropdown?.()])
        }
      }))
    }
    app.mount(renderer.root)
    try {
      const dropdown = findNode(renderer.root, 'ElDropdown')
      expect(dropdown).not.toBeNull()
      dropdown.props.onCommand('add-child-agent')
      dropdown.props.onCommand('new-session')
      expect(onAddChildAgent).toHaveBeenCalledWith(agent)
      expect(onNewSession).toHaveBeenCalledWith(agent)
    } finally {
      app.unmount()
    }
  })
})
