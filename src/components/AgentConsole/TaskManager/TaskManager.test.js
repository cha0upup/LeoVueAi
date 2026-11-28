import { nextTick, ref } from 'vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { compileClientComponent, createSlotStub, findNode, findNodes } from '@/test-support/vueComponent.js'
import { createTestRenderer } from '@/test-support/vueRenderer.js'
import * as taskConstants from '@/constants/task.js'
import { icons } from '@/utils/icons.js'
import { createLatestRequestGuard } from '@/utils/latestRequestGuard.js'
import { useTaskCenterView } from '@/composables/useTaskCenterView.js'
import * as model from './taskManagerModel.js'

const { TaskStatus, TaskType } = taskConstants
const listeners = new Map()
const engine = {
  getTasksBySession: vi.fn(),
  on: (event, listener) => listeners.set(event, listener),
  off: (event) => listeners.delete(event)
}
const emptyTasks = { data: { tasks: [] } }
const buildTaskList = vi.fn(model.buildTaskList)
const getSqlExportTasksApi = vi.fn()
const View = compileClientComponent(new URL('./TaskManager.vue', import.meta.url), {
  '@iconify/vue': { Icon: createSlotStub('FixtureIcon') },
  '@/utils/confirmUtils.js': { confirmDelete: vi.fn() },
  '@/utils/icons.js': { icons },
  '@/utils/downloadBlob.js': { downloadBlob: vi.fn() },
  '../File/TaskEngine.js': { taskEngine: engine },
  '@/constants/task.js': taskConstants,
  '@/services/api/agent-files.js': {
    downloadEngineTasksApi: vi.fn().mockResolvedValue(emptyTasks),
    uploadEngineTasksApi: vi.fn().mockResolvedValue(emptyTasks)
  },
  '@/services/api/scan.js': {},
  '@/services/api/sql.js': { getSqlExportTasksApi },
  '../Scan/useAssetDiscoveryTasks.js': {
    useAssetDiscoveryTasks: () => {
      const tasks = ref([])
      return { tasks, selectedTaskId: ref(null), loadError: ref(''), hasMoreHistory: ref(false),
        syncTasks: async () => { tasks.value = [] } }
    }
  },
  '@/composables/useTaskCenterView.js': { useTaskCenterView },
  '@/utils/messageUtils.js': {},
  '@/utils/latestRequestGuard.js': { createLatestRequestGuard },
  './TaskManagerDetail.vue': { default: createSlotStub('FixtureDetail') },
  './TaskManagerFilters.vue': { default: createSlotStub('FixtureFilters', ['sync']) },
  './TaskManagerTaskCard.vue': { default: createSlotStub('FixtureTaskCard') },
  './taskManagerModel.js': { ...model, buildTaskList }
})
let app

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('window', { setInterval: vi.fn(), clearInterval: vi.fn() })
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    disconnect() {}
  })
  getSqlExportTasksApi.mockResolvedValue(emptyTasks)
})

afterEach(() => {
  app?.unmount()
  app = null
  vi.unstubAllGlobals()
})

it('merges one refresh once and observes local stages that change without events', async () => {
  const local = { id: 'upload', sessionId: 'session-1', type: TaskType.UPLOAD,
    status: TaskStatus.UPLOADING, currentStage: 'TRANSFERRING' }
  engine.getTasksBySession.mockImplementation(() => [local])
  const renderer = createTestRenderer()
  app = renderer.createApp(View, { sessionId: 'session-1' })
  app.component('ElButton', createSlotStub('FixtureButton'))
  app.component('ElDrawer', createSlotStub('FixtureDrawer'))
  app.mount(renderer.root)
  const refresh = () => findNode(renderer.root, 'FixtureButton').props
  await vi.waitFor(() => expect(refresh().loading).toBe(false))
  buildTaskList.mockClear()
  engine.getTasksBySession.mockClear()

  local.currentStage = 'COMMITTING'
  getSqlExportTasksApi.mockResolvedValueOnce({ data: { tasks: [{ taskId: 'export', status: 'COMPLETED' }] } })
  await refresh().onClick()
  await nextTick()

  expect(buildTaskList).toHaveBeenCalledOnce()
  expect(engine.getTasksBySession).toHaveBeenCalledExactlyOnceWith('session-1')
  const cards = findNodes(renderer.root, node => node.type === 'FixtureTaskCard').map(node => node.props.task)
  expect(cards).toEqual(expect.arrayContaining([
    expect.objectContaining({ viewId: 'upload', currentStage: 'COMMITTING' }),
    expect.objectContaining({ serverTaskId: 'export', status: TaskStatus.COMPLETED })
  ]))

  listeners.get('taskProgress')({ sessionId: 'session-2' })
  await nextTick()
  expect(buildTaskList).toHaveBeenCalledOnce()
  expect(engine.getTasksBySession).toHaveBeenCalledTimes(1)
  local.progress = 80
  listeners.get('taskProgress')(local)
  await nextTick()
  const upload = findNodes(renderer.root,
    node => node.type === 'FixtureTaskCard' && node.props.task.viewId === 'upload')[0]
  expect(upload.props.task.progress).toBe(80)
})
