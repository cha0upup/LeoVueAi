import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { compileClientComponent } from '@/test-support/compileClientComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import { icons } from '@/utils/icons.js'

const themes = [
  { value: 'light', name: 'IDEA 明亮' },
  { value: 'dark', name: 'IDEA 黑暗' }
]
const fixture = { store: null }
const ThemeSwitcher = compileClientComponent(new URL('./ThemeSwitcher.vue', import.meta.url), {
  '@/utils/icons.js': { icons },
  '@/stores/theme': { useTheme: () => fixture.store }
})
const nodes = (node) => [node, ...node.children.flatMap(nodes)]
const textContent = (node) => node.type === 'comment'
  ? ''
  : node.text + node.children.map(textContent).join('')

describe('ThemeSwitcher compact icon trigger', () => {
  const apps = []
  afterEach(() => apps.splice(0).forEach((app) => app.unmount()))

  function mount(initialTheme = 'light') {
    const currentTheme = ref(initialTheme)
    const store = {
      currentTheme,
      getCurrentTheme: () => themes.find((theme) => theme.value === currentTheme.value),
      getAvailableThemes: () => themes,
      setTheme: vi.fn((value) => { currentTheme.value = value })
    }
    fixture.store = store
    const renderer = createTestRenderer()
    const app = renderer.createApp(ThemeSwitcher)
    for (const name of ['ElDropdown', 'ElDropdownMenu', 'ElDropdownItem', 'ElIcon', 'Icon']) {
      app.component(name, defineComponent({
        inheritAttrs: false,
        setup(_props, { attrs, slots }) {
          return () => h(name, attrs, [slots.default?.(), slots.dropdown?.()])
        }
      }))
    }
    app.mount(renderer.root)
    apps.push(app)
    return {
      store,
      find: (predicate) => nodes(renderer.root).filter(predicate),
      button: () => nodes(renderer.root).find((node) => node.type === 'button')
    }
  }

  it('renders only one icon, without the theme name, caption, arrow, or icon shell', () => {
    const view = mount()
    const button = view.button()
    expect(button.props.type).toBe('button')
    expect(textContent(button)).toBe('')
    expect(nodes(button).filter((node) => node.type === 'Icon')).toHaveLength(1)
    expect(view.find((node) => ['theme-copy', 'theme-arrow', 'theme-icon-shell'].includes(node.props.class)))
      .toHaveLength(0)
  })

  it.each([
    ['light', 'IDEA 明亮', icons.sunny],
    ['dark', 'IDEA 黑暗', icons.moon]
  ])('keeps the %s theme discoverable through its icon, label, and hover title', (value, name, icon) => {
    const view = mount(value)
    const button = view.button()
    expect(button.props['aria-label']).toBe(`切换主题（当前：${name}）`)
    expect(button.props.title).toBe(button.props['aria-label'])
    expect(nodes(button).find((node) => node.type === 'Icon').props.icon).toBe(icon)
  })

  it('preserves the theme menu and updates the icon, accessible label, and active item', async () => {
    const view = mount()
    const dropdown = view.find((node) => node.type === 'ElDropdown')[0]
    expect(dropdown.props.trigger).toBe('click')
    expect(view.find((node) => node.type === 'ElDropdownItem').map((node) => node.props.command))
      .toEqual(['light', 'dark'])
    dropdown.props.onCommand('dark')
    await nextTick()
    expect(view.store.setTheme).toHaveBeenCalledWith('dark')
    expect(view.button().props['aria-label']).toContain('IDEA 黑暗')
    expect(nodes(view.button()).find((node) => node.type === 'Icon').props.icon).toBe(icons.moon)
    const items = view.find((node) => node.type === 'ElDropdownItem')
    expect(items.find((node) => node.props.command === 'dark').props.class).toContain('is-active')
    expect(items.find((node) => node.props.command === 'light').props.class).not.toContain('is-active')
  })
})
