import { defineComponent, h } from 'vue'
import * as Vue from 'vue'
import { readFileSync } from 'node:fs'
import { compileScript, parse } from '@vue/compiler-sfc'
import { describe, expect, it, vi } from 'vitest'
import { createTestRenderer } from '../../test-support/vueRenderer.js'
import { icons } from '@/utils/icons.js'

// Use the real client template with the in-memory renderer, like App.session.test.
// Vitest's default Node transform otherwise emits an SSR-only component.
const { descriptor } = parse(readFileSync(new URL('./AgentHeroActions.vue', import.meta.url), 'utf8'))
const modules = { vue: Vue, '@/utils/icons.js': { icons } }
const compiled = compileScript(descriptor, { id: 'agent-hero-actions-test', inlineTemplate: true }).content
  .replace(/^import\s+(\{[^}]+\}|\w+)\s+from\s+['"]([^'"]+)['"];?$/gm, (_line, names, path) => {
    if (!modules[path]) throw new Error(`Unexpected AgentHeroActions import: ${path}`)
    const binding = names.startsWith('{') ? names.replace(/\s+as\s+/g, ': ') : `{ default: ${names} }`
    return `const ${binding} = modules[${JSON.stringify(path)}]`
  })
  .replace('export default', 'return')
const AgentHeroActions = new Function('modules', compiled)(modules)

const findNode = (node, type) => {
  if (node.type === type) return node
  for (const child of node.children) {
    const found = findNode(child, type)
    if (found) return found
  }
  return null
}

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
