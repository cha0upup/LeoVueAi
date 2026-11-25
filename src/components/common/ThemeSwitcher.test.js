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

  function mount() {
    const currentTheme = ref('light')
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

  it('shows both theme previews and updates the button and accessible selection when switching', async () => {
    const view = mount()
    const button = view.button()
    expect(button.props).toMatchObject({
      type: 'button', 'aria-label': '切换主题（当前：明亮）', title: '切换主题（当前：明亮）'
    })
    expect(textContent(button)).toBe('')
    expect(nodes(button).filter(node => node.type === 'Icon').map(node => node.props.icon)).toEqual([icons.sunny])

    const dropdown = view.find((node) => node.type === 'ElDropdown')[0]
    expect(dropdown.props.trigger).toBe('click')
    expect(view.find(node => node.type === 'ElDropdownMenu')[0].props['aria-label']).toBe('界面主题')
    const items = () => view.find(node => node.type === 'ElDropdownItem')
    expect(items().map(node => [node.props.command, textContent(node)])).toEqual([['light', '明亮'], ['dark', '黑暗']])
    expect(view.find(node => node.props.class === 'theme-preview').map(node => node.props['data-theme']))
      .toEqual(['light', 'dark'])
    expect(items().map(node => node.props['aria-current'])).toEqual(['true', undefined])

    dropdown.props.onCommand('dark')
    await nextTick()
    expect(view.store.setTheme).toHaveBeenCalledWith('dark')
    expect(view.button().props).toMatchObject({
      'aria-label': '切换主题（当前：黑暗）', title: '切换主题（当前：黑暗）'
    })
    expect(nodes(view.button()).find((node) => node.type === 'Icon').props.icon).toBe(icons.moon)
    expect(items().map(node => node.props['aria-current'])).toEqual([undefined, 'true'])
  })
})
