import { computed, nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { TaskStatus, TaskType } from '@/constants/task.js'
import { useTaskCenterView } from './useTaskCenterView.js'

const createView = initialTasks => {
  const tasks = ref(initialTasks)
  const activeTaskType = ref(TaskType.DOWNLOAD)
  const statusFilter = ref('all')
  const searchKeyword = ref('')
  const sortOption = ref('latest')
  const selectedTaskId = ref('')
  const view = useTaskCenterView({
    tasks: computed(() => tasks.value),
    activeTaskType,
    statusFilter,
    searchKeyword,
    sortOption,
    selectedTaskId,
    activeStatuses: [TaskStatus.PENDING, TaskStatus.DOWNLOADING]
  })
  return {
    ...view,
    tasks,
    activeTaskType,
    statusFilter,
    searchKeyword,
    sortOption,
    selectedTaskId
  }
}

describe('useTaskCenterView', () => {
  it('filters, searches and sorts timestamps from mixed server formats', async () => {
    const older = {
      viewId: 'old',
      type: TaskType.DOWNLOAD,
      status: TaskStatus.COMPLETED,
      fileName: 'Alpha',
      endTime: '2026-07-14T08:00:00Z'
    }
    const newer = {
      viewId: 'new',
      type: TaskType.DOWNLOAD,
      status: TaskStatus.DOWNLOADING,
      fileName: 'Beta',
      serverTaskId: 'MATCH-1',
      endTime: '2026-07-15T08:00:00Z'
    }
    const view = createView([older, newer])
    expect(view.filteredTasks.value.map(task => task.viewId)).toEqual(['new', 'old'])

    view.searchKeyword.value = 'match'
    await nextTick()
    expect(view.filteredTasks.value).toEqual([newer])
    expect(view.selectedTaskId.value).toBe('new')

    view.statusFilter.value = 'completed'
    await nextTick()
    expect(view.filteredTasks.value).toEqual([])
    expect(view.selectedTaskId.value).toBe('')
  })

  it('keeps selection valid when type or task data changes', async () => {
    const view = createView([
      { viewId: 'd1', type: TaskType.DOWNLOAD, status: TaskStatus.PENDING },
      { viewId: 'u1', type: TaskType.UPLOAD, status: TaskStatus.UPLOADING }
    ])
    expect(view.selectedTaskId.value).toBe('d1')

    view.setActiveTaskType(TaskType.UPLOAD)
    await nextTick()
    expect(view.selectedTaskId.value).toBe('u1')

    view.tasks.value = []
    await nextTick()
    expect(view.selectedTaskId.value).toBe('')
  })
})
