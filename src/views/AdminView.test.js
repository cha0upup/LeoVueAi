import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, onMounted, reactive, ref } from 'vue'
import { compileClientComponent, createSlotStub, findNode } from '@/test-support/vueComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import { ROUTE_PATHS } from '@/constants/app.js'
import { icons } from '@/utils/icons.js'

const route = reactive({ query: {}, fullPath: ROUTE_PATHS.admin })
const router = {
  resolve: ({ query }) => ({ fullPath: `${ROUTE_PATHS.admin}?tab=${query.tab}` }),
  replace: vi.fn(),
  push: vi.fn()
}
const auth = { currentUser: ref({ userId: 'fixture' }), isAdmin: ref(true), isLeader: ref(false), fetchAuth: vi.fn() }
const mountUserManager = vi.fn()
const UserManager = defineComponent({
  setup() {
    onMounted(mountUserManager)
    return () => h('UserManager')
  }
})
const stub = (name) => ({ default: createSlotStub(name) })
const View = compileClientComponent(new URL('./AdminView.vue', import.meta.url), {
  'vue-router': { useRouter: () => router, useRoute: () => route },
  '@/components/Admin/audit/AuditManager.vue': stub('AuditManager'),
  '@/components/Admin/audit/AuditStatistics.vue': stub('AuditStatistics'),
  '@/components/Admin/teams/TeamManager.vue': stub('TeamManager'),
  '@/components/Admin/users/UserManager.vue': { default: UserManager },
  '@/components/Settings/AiChannelSettings.vue': stub('AiChannelSettings'),
  '@/constants/app.js': { ROUTE_PATHS },
  '@/utils/icons.js': { icons },
  '@/composables/useAppModeNavigation.js': { useAppModeNavigation: () => ({ rememberAdminRoute: vi.fn() }) },
  '@/composables/useAuth.js': { useAuth: () => auth },
  '@/utils/browserStorage.js': { safeLocalStorage: { getItem: vi.fn(), setItem: vi.fn() } }
})
const apps = []

async function mount(tab) {
  route.query = { tab }
  route.fullPath = `${ROUTE_PATHS.admin}?tab=${tab}`
  const renderer = createTestRenderer()
  const app = renderer.createApp(View)
  for (const name of ['Icon', 'ElIcon']) app.component(name, createSlotStub(name))
  app.mount(renderer.root)
  apps.push(app)
  for (let i = 0; i < 4; i++) await nextTick()
  return (name) => findNode(renderer.root, name)
}

beforeEach(() => {
  vi.clearAllMocks()
  auth.isAdmin.value = true
  auth.isLeader.value = false
})
afterEach(() => { for (const app of apps.splice(0)) app.unmount() })

it('opens a direct statistics link without mounting or requesting a user directory first', async () => {
  const node = await mount('statistics')
  expect(node('AuditStatistics')).toBeTruthy()
  expect(mountUserManager).not.toHaveBeenCalled()
  expect(router.replace).not.toHaveBeenCalled()
})

it('keeps admin-only sections hidden from a team leader and normalizes the route', async () => {
  auth.isAdmin.value = false
  auth.isLeader.value = true
  const node = await mount('statistics')
  expect(node('AuditStatistics')).toBeNull()
  expect(node('UserManager')).toBeTruthy()
  expect(router.replace).toHaveBeenCalledWith({ path: ROUTE_PATHS.admin, query: { tab: 'users' } })
})
