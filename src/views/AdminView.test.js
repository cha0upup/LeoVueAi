import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, onMounted, reactive, ref } from 'vue'
import { compileClientComponent, createSlotStub, findNode, findNodes } from '@/test-support/vueComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import { ROUTE_PATHS } from '@/constants/app.js'
import { icons } from '@/utils/icons.js'
import { adminTabGroups } from '@/components/Admin/adminTabs.js'
import { deferred } from '@/test-support/deferred.js'

const route = reactive({ path: ROUTE_PATHS.admin, query: {}, fullPath: ROUTE_PATHS.admin })
const router = {
  resolve: ({ query }) => ({ fullPath: `${ROUTE_PATHS.admin}?tab=${query.tab}` }),
  replace: vi.fn(),
  push: vi.fn(),
  go: vi.fn()
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
const components = { users: UserManager, teams: createSlotStub('TeamManager'), audit: createSlotStub('AuditManager'),
  statistics: createSlotStub('AuditStatistics'), system: createSlotStub('AiChannelSettings') }
const panelLoaders = Object.fromEntries(Object.keys(components).map(name => [name, vi.fn()]))
const groups = adminTabGroups.map(group => ({ ...group,
  tabs: group.tabs.map(tab => ({ ...tab, load: panelLoaders[tab.name] }))
}))
const View = compileClientComponent(new URL('./AdminView.vue', import.meta.url), {
  'vue-router': { useRouter: () => router, useRoute: () => route },
  '@/components/Admin/adminTabs.js': { adminTabGroups: groups },
  '@/components/common/EmptyState.vue': stub('EmptyState'),
  '@/constants/app.js': { ROUTE_PATHS },
  '@/utils/icons.js': { icons },
  '@/composables/useAppModeNavigation.js': { useAppModeNavigation: () => ({ rememberAdminRoute: vi.fn() }) },
  '@/composables/useAuth.js': { useAuth: () => auth },
  '@/utils/browserStorage.js': { safeLocalStorage: { getItem: vi.fn(), setItem: vi.fn() } }
})
const apps = []
const flush = async () => { for (let i = 0; i < 8; i++) await nextTick() }

async function mount(tab) {
  route.path = ROUTE_PATHS.admin
  route.query = { tab }
  route.fullPath = `${ROUTE_PATHS.admin}?tab=${tab}`
  const renderer = createTestRenderer()
  const app = renderer.createApp(View)
  app.config.errorHandler = vi.fn()
  for (const name of ['Icon', 'ElIcon']) app.component(name, createSlotStub(name))
  app.mount(renderer.root)
  apps.push(app)
  await flush()
  return (name) => findNode(renderer.root, name)
}

beforeEach(() => {
  vi.clearAllMocks()
  auth.isAdmin.value = true
  auth.isLeader.value = false
  for (const [name, load] of Object.entries(panelLoaders)) load.mockReset().mockResolvedValue(components[name])
})
afterEach(() => { for (const app of apps.splice(0)) app.unmount() })

it('opens a direct statistics link without mounting or requesting a user directory first', async () => {
  const node = await mount('statistics')
  expect(node('AuditStatistics')).toBeTruthy()
  expect(mountUserManager).not.toHaveBeenCalled()
  expect(panelLoaders.statistics).toHaveBeenCalledOnce()
  for (const name of ['users', 'teams', 'audit', 'system']) expect(panelLoaders[name]).not.toHaveBeenCalled()
  expect(router.replace).not.toHaveBeenCalled()
})

it('keeps admin-only sections hidden from a team leader and normalizes the route', async () => {
  auth.isAdmin.value = false
  auth.isLeader.value = true
  const node = await mount('statistics')
  expect(node('AuditStatistics')).toBeNull()
  expect(panelLoaders.statistics).not.toHaveBeenCalled()
  expect(node('UserManager')).toBeTruthy()
  expect(router.replace).toHaveBeenCalledWith({ path: ROUTE_PATHS.admin, query: { tab: 'users' } })
})

it('does not mount an old panel that finishes loading after a tab switch', async () => {
  const slow = deferred()
  panelLoaders.users.mockReturnValueOnce(slow.promise)
  const node = await mount('users')
  expect(node('UserManager')).toBeNull()

  route.query = { tab: 'users', teamId: 'team' }
  const teamsTab = findNodes(node('nav'), item => item.props['data-tab'] === 'teams')[0]
  teamsTab.props.onClick()
  expect(router.push).toHaveBeenCalledWith({ path: ROUTE_PATHS.admin, query: { tab: 'teams' } })
  route.query = { tab: 'teams' }
  await flush()
  expect(node('TeamManager')).toBeTruthy()
  slow.resolve(UserManager)
  await flush()
  expect(mountUserManager).not.toHaveBeenCalled()

  route.path = ROUTE_PATHS.main
  route.query = {}
  await flush()
  expect(router.replace).not.toHaveBeenCalled()
})

it('replaces an admin-only tab when the current user switches to leader access', async () => {
  const node = await mount('audit')
  expect(node('AuditManager')).toBeTruthy()

  auth.isLeader.value = true
  auth.isAdmin.value = false
  await flush()
  expect(node('AuditManager')).toBeNull()
  expect(node('UserManager')).toBeTruthy()
  expect(router.replace).toHaveBeenCalledWith({ path: ROUTE_PATHS.admin, query: { tab: 'users' } })
})

it('leaves a reload action when a selected panel fails to load', async () => {
  panelLoaders.audit.mockRejectedValueOnce(new Error('missing chunk'))
  const node = await mount('audit')
  expect(node('EmptyState').props.title).toBe('管理模块加载失败')
  expect(node('EmptyState').props.actionLabel).toBe('刷新页面')
  node('EmptyState').props.onAction()
  expect(router.go).toHaveBeenCalledWith(0)
})
