import { afterEach, describe, expect, it, vi } from 'vitest'
import { cloneVNode, h, nextTick, reactive, ref } from 'vue'
import { compileClientComponent, createSlotStub, findNodes } from '@/test-support/vueComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'

const storage = { getItem: vi.fn(), setItem: vi.fn() }
const Dock = compileClientComponent(new URL('./AiDock.vue', import.meta.url), {
  '@/components/common/AiNotConfiguredEmpty.vue': { default: createSlotStub('AiEmpty') },
  '@/composables/useAiAvailability.js': { useAiAvailability: () => ({ available: ref(false) }) },
  '@/utils/browserStorage.js': { safeLocalStorage: storage }
})
const apps = []
afterEach(() => { apps.splice(0).forEach(app => app.unmount()); vi.clearAllMocks(); vi.unstubAllGlobals() })

async function mount(width = 1280, savedWidth = '500') {
  storage.getItem.mockReturnValue(savedWidth)
  let onResize
  const disconnect = vi.fn()
  const observe = vi.fn()
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback) { onResize = callback }
    observe = observe
    disconnect = disconnect
  })
  const renderer = createTestRenderer()
  const props = reactive({ sessionId: 'fixture', visible: true })
  const Fixture = { ...Dock, setup(props, context) {
    const render = Dock.setup(props, context)
    return (...args) => cloneVNode(render(...args), { onVnodeMounted: vnode => {
      vnode.el.parentElement = { clientWidth: width }
    } })
  } }
  const app = renderer.createApp({ render: () => h(Fixture, props) })
  app.mount(renderer.root)
  apps.push(app)
  await nextTick()
  const node = cls => findNodes(renderer.root).find(item => item.props.class?.split(' ').includes(cls))
  return { app, props, disconnect, observe, node, resize: async width => {
    onResize([{ contentRect: { width } }]); await nextTick()
  } }
}

describe('AI dock sizing', () => {
  it('reserves tool space on desktop, fits a narrow pane and preserves the saved preference during resize', async () => {
    const view = await mount(1280, '840')
    expect(view.node('ai-dock').props.style.width).toBe('800px')
    expect(view.observe).toHaveBeenCalledOnce()
    await view.resize(700)
    expect(view.node('ai-dock').props.style.width).toBe('674px')
    expect(view.node('dock-resize-handle').props['aria-valuemax']).toBe(674)
    await view.resize(360)
    expect(view.node('ai-dock').props.style.width).toBe('334px')
    expect(view.node('dock-resize-handle').props['aria-valuemin']).toBe(334)
    await view.resize(1440)
    expect(view.node('ai-dock').props.style.width).toBe('840px')
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it('supports keyboard resizing with accurate ARIA bounds and persists only the chosen width', async () => {
    const view = await mount()
    const handle = () => view.node('dock-resize-handle')
    expect(handle().props.tabindex).toBe('0')
    const keydown = key => {
      const handlers = handle().props.onKeydown
      for (const handler of Array.isArray(handlers) ? handlers : [handlers]) handler({ key, preventDefault: vi.fn() })
    }
    keydown('ArrowLeft')
    await nextTick()
    expect(handle().props['aria-valuenow']).toBe(520)
    expect(storage.setItem).toHaveBeenLastCalledWith('node-ai-dock-width', 520)
    keydown('End')
    await nextTick()
    expect(handle().props['aria-valuenow']).toBe(800)
    keydown('Home')
    await nextTick()
    expect(handle().props['aria-valuenow']).toBe(380)
  })

  it('uses primary-pointer capture and releases it when hidden or unmounted', async () => {
    const view = await mount()
    const pointer = { setPointerCapture: vi.fn(), hasPointerCapture: () => true, releasePointerCapture: vi.fn() }
    const event = { button: 0, pointerId: 7, clientX: 500, currentTarget: pointer, preventDefault: vi.fn() }
    const handle = () => view.node('dock-resize-handle')
    handle().props.onPointerdown({ ...event, button: 2 })
    expect(pointer.setPointerCapture).not.toHaveBeenCalled()
    handle().props.onPointerdown(event)
    handle().props.onPointermove({ pointerId: 8, clientX: 300 })
    await nextTick()
    expect(view.node('ai-dock').props.style.width).toBe('500px')
    handle().props.onPointermove({ pointerId: 7, clientX: 300 })
    await nextTick()
    expect(view.node('ai-dock').props.style.width).toBe('700px')
    view.props.visible = false
    await nextTick()
    expect(pointer.releasePointerCapture).toHaveBeenCalledWith(7)
    expect(view.node('ai-dock').props.style.width).toBe('0px')
    expect(storage.setItem).toHaveBeenLastCalledWith('node-ai-dock-width', 700)
    view.props.visible = true
    await nextTick()
    handle().props.onPointerdown(event)
    view.app.unmount()
    apps.splice(apps.indexOf(view.app), 1)
    expect(pointer.releasePointerCapture).toHaveBeenCalledTimes(2)
    expect(view.disconnect).toHaveBeenCalledOnce()
    expect(storage.setItem).toHaveBeenCalledOnce()
  })

  it('falls back to a usable width when storage contains invalid data', async () => {
    const view = await mount(1280, 'broken')
    expect(view.node('ai-dock').props.style.width).toBe('500px')
  })
})
