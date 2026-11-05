import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { compileClientComponent, createSlotStub, findNodes as nodes } from '@/test-support/vueComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import { icons } from '@/utils/icons.js'

const themes = [
  { value: 'light', name: '明亮' },
  { value: 'dark', name: '黑暗' }
]
const fixture = { store: null }
const ThemeSwitcher = compileClientComponent(new URL('./ThemeSwitcher.vue', import.meta.url), {
  '@/utils/icons.js': { icons },
  '@/stores/theme': { useTheme: () => fixture.store }
})
const textContent = (node) => node.type === 'comment'
  ? ''
  : node.text + node.children.map(textContent).join('')

describe('ThemeSwitcher preview cards', () => {
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
      app.component(name, createSlotStub(name, ['default', 'dropdown']))
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
    ['light', '明亮', icons.sunny],
    ['dark', '黑暗', icons.moon]
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
    expect(view.button().props['aria-label']).toContain('黑暗')
    expect(nodes(view.button()).find((node) => node.type === 'Icon').props.icon).toBe(icons.moon)
    const items = view.find((node) => node.type === 'ElDropdownItem')
    expect(items.find((node) => node.props.command === 'dark').props.class).toContain('is-active')
    expect(items.find((node) => node.props.command === 'dark').props['aria-current']).toBe('true')
    expect(items.find((node) => node.props.command === 'light').props.class).not.toContain('is-active')
    expect(items.find((node) => node.props.command === 'light').props['aria-current']).toBeUndefined()
  })

  it('keeps only theme names, visual previews, and the selection mark in the menu', () => {
    const view = mount()
    const menu = view.find(node => node.type === 'ElDropdownMenu')[0]
    expect(menu.props['aria-label']).toBe('界面主题')
    expect(textContent(menu)).toBe(themes.map(theme => theme.name).join(''))
    expect(view.find(node => ['theme-menu-head', 'theme-menu-tip', 'theme-value', 'theme-text', 'theme-preview-dot']
      .includes(node.props.class))).toHaveLength(0)
    expect(view.find(node => node.props.class === 'theme-preview')).toHaveLength(2)
    expect(view.find(node => node.props.class === 'check-icon')).toHaveLength(1)
  })

  it('offers two preview cards with separate light and dark palettes and unchanged theme commands', () => {
    const view = mount()
    const cards = view.find(node => node.type === 'ElDropdownItem')
    expect(cards.every(card => card.props.class.includes('theme-card'))).toBe(true)
    expect(cards.map(card => card.props.command)).toEqual(['light', 'dark'])
    expect(view.find(node => node.props.class === 'theme-preview').map(node => node.props['data-theme']))
      .toEqual(['light', 'dark'])
    expect(view.find(node => node.props.class === 'theme-preview__toolbar')).toHaveLength(2)
    expect(view.find(node => node.props.class === 'theme-preview__sidebar')).toHaveLength(2)
    expect(view.find(node => node.props.class === 'theme-preview__panel')).toHaveLength(2)
    expect(cards.map(textContent)).toEqual(['明亮', '黑暗'])
  })
})
