/* eslint-disable vue/one-component-per-file -- Multiple fixture views exercise one app lifecycle. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, onMounted, onUnmounted, reactive } from 'vue'
import * as Vue from 'vue'
import { readFileSync } from 'node:fs'
import { compileScript, parse } from '@vue/compiler-sfc'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import { useAuth } from '@/composables/useAuth.js'
import { ROUTE_PATHS } from '@/constants/app.js'
import { sessionGeneration } from '@/services/sessionLifecycle.js'

const mocks = vi.hoisted(() => ({ route: null }))
vi.mock('@/services/api/auth.js', () => ({ getLoginStatusApi: vi.fn() }))

// Vitest's Node transform compiles .vue files for SSR. Compile this real template
// for the client so the test exercises KeepAlive instead of SSR's no-op wrapper.
const { descriptor } = parse(readFileSync(new URL('./App.vue', import.meta.url), 'utf8'))
const modules = {
  vue: Vue,
  'vue-router': { useRoute: () => mocks.route },
  '@/components/common/GlobalAppHeader.vue': { default: { render: () => null } },
  '@/constants/app.js': { ROUTE_PATHS },
  '@/stores/theme': { useTheme: () => ({ initTheme: vi.fn() }) },
  '@/services/sessionLifecycle.js': { sessionGeneration },
  '@/composables/useAuth.js': { useAuth }
}
const compiled = compileScript(descriptor, { id: 'app-session-test', inlineTemplate: true }).content
  .replace(/^import\s+(\{[^}]+\}|\w+)\s+from\s+['"]([^'"]+)['"];?$/gm, (line, names, path) => {
    if (!modules[path]) throw new Error(`Unexpected App import: ${path}`)
    const binding = names.startsWith('{') ? names.replace(/\s+as\s+/g, ': ') : `{ default: ${names} }`
    return `const ${binding} = modules[${JSON.stringify(path)}]`
  })
  .replace('export default', 'return')
const App = new Function('modules', compiled)(modules)

describe('app protected workspace lifecycle', () => {
  let app
  const mounted = vi.fn()
  const unmounted = vi.fn()
  const loginMounted = vi.fn()

  const mount = () => {
    const Main = defineComponent({
      name: 'MainView',
      setup() {
        const owner = useAuth().currentUser.value.userId
        onMounted(() => mounted(owner))
        onUnmounted(() => unmounted(owner))
        return () => h('div', owner)
      }
    })
    const Login = defineComponent({
      setup() {
        onMounted(loginMounted)
        return () => h('div', 'login')
      }
    })
    const Admin = { render: () => h('div', 'admin') }
    const RouterView = {
      setup(props, { slots }) {
        return () => slots.default({
          Component: mocks.route.path === '/login' ? Login : mocks.route.path === '/admin' ? Admin : Main
        })
      }
    }
    const { createApp, root } = createTestRenderer()
    app = createApp(App)
    app.component('RouterView', RouterView)
    app.mount(root)
  }

  beforeEach(() => {
    useAuth().resetAuth()
    vi.clearAllMocks()
    mocks.route = reactive({ path: '/main', meta: { requiresAuth: true } })
  })
  afterEach(() => app?.unmount())

  it('destroys the previous workspace immediately and mounts a fresh one for the next user', async () => {
    const auth = useAuth()
    auth.currentUser.value = { userId: 'a' }
    mount()
    expect(mounted).toHaveBeenCalledWith('a')
    auth.resetAuth()
    await nextTick()
    expect(unmounted).toHaveBeenCalledWith('a')
    expect(mounted).toHaveBeenCalledOnce()
    auth.currentUser.value = { userId: 'b' }
    await nextTick()
    expect(mounted).toHaveBeenLastCalledWith('b')
    expect(mounted).toHaveBeenCalledTimes(2)
  })

  it('preserves MainView across admin navigation within the same login', async () => {
    useAuth().currentUser.value = { userId: 'a' }
    mount()
    mocks.route.path = '/admin'
    await nextTick()
    expect(unmounted).not.toHaveBeenCalled()
    mocks.route.path = '/main'
    await nextTick()
    expect(mounted).toHaveBeenCalledOnce()
  })

  it('keeps the public login form mounted during an identity reset', async () => {
    mocks.route.path = '/login'
    mocks.route.meta = {}
    mount()
    useAuth().resetAuth()
    await nextTick()
    expect(loginMounted).toHaveBeenCalledOnce()
    expect(mounted).not.toHaveBeenCalled()
  })
})
