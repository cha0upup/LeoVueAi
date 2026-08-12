<template>
  <div class="task-manager-page">
    <div class="task-workspace">
      <section class="task-main-panel">
        <TaskManagerFilters
          :type-options="typeOptions"
          :status-options="statusOptions"
          :active-task-type="activeTaskType"
          :status-filter="statusFilter"
          :search-keyword="searchKeyword"
          :sort-option="sortOption"
          :result-count="filteredTasks.length"
          @update:type="setActiveTaskType"
          @update:status="setStatusFilter"
          @update:search="setSearchKeyword"
          @update:sort="setSortOption"
        />

        <div
          v-if="filteredTasks.length === 0"
          class="task-empty-state"
        >
          <el-empty
            description="没有匹配的任务，换个筛选条件试试"
            :image-size="120"
          />
        </div>
        <div
          v-else
          class="task-list"
        >
          <TaskManagerTaskCard
            v-for="task in filteredTasks"
            :key="task.viewId"
            :task="task"
            :is-selected="selectedTaskId === task.viewId"
            :status-text="getStatusText(task.status)"
            :status-key="getIndicatorStatus(task.status)"
            :type-label="getTaskTypeLabel(task.type)"
            :type-icon="getTaskTypeIcon(task.type, iconMap)"
            :progress-status="getProgressStatus(task.status)"
            :primary-action="getPrimaryTaskAction(task, iconMap)"
            :secondary-actions="getSecondaryTaskActions(task, iconMap)"
            @select="selectTask(task.viewId)"
            @action="handleTaskAction($event, task)"
          />
        </div>
      </section>

      <TaskManagerDetail
        :task="selectedTask"
        :primary-action="selectedPrimaryAction"
        :secondary-actions="selectedSecondaryActions"
        @action="handleTaskAction($event, selectedTask)"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { confirmDelete } from '@/utils/confirmUtils.js'
import { icons } from '@/utils/icons.js'
import { taskEngine } from '../File/TaskEngine.js'
import { ACTIVE_TASK_STATUSES, TaskStatus, TaskType } from '@/constants/task.js'
import {
  downloadEngineCancelApi,
  downloadEnginePauseApi,
  downloadEngineRemoveApi,
  downloadEngineResumeApi,
  downloadEngineRetryApi,
  downloadEngineTasksApi,
  downloadLocalFileApi,
  getSqlExportTasksApi,
  uploadEngineCancelApi,
  uploadEnginePauseApi,
  uploadEngineRemoveApi,
  uploadEngineResumeApi,
  uploadEngineRetryApi,
  uploadEngineTasksApi
} from '@/services/api.js'
import { useTaskCenterView } from '@/composables/useTaskCenterView.js'
import { showError, showInfo, showSuccess } from '@/utils/messageUtils.js'
import { createLatestRequestGuard } from '@/utils/latestRequestGuard.js'
import TaskManagerDetail from './TaskManagerDetail.vue'
import TaskManagerFilters from './TaskManagerFilters.vue'
import TaskManagerTaskCard from './TaskManagerTaskCard.vue'
import {
  buildTaskList,
  getDownloadRelativePath,
  getIndicatorStatus,
  getPrimaryTaskAction,
  getProgressStatus,
  getSecondaryTaskActions,
  getStatusText,
  getTaskTypeIcon,
  getTaskTypeLabel,
  normalizeServerDownloadTask,
  normalizeServerUploadTask,
  normalizeServerSqlExportTask
} from './taskManagerModel.js'

const props = defineProps({
  sessionId: { type: String, required: true }
})

const iconMap = icons
const activeTaskType = ref(TaskType.DOWNLOAD)
const statusFilter = ref('all')
const searchKeyword = ref('')
const sortOption = ref('latest')
const selectedTaskId = ref('')
const tasks = ref([])
const serverDownloadTasks = ref([])
const serverUploadTasks = ref([])
const serverSqlExportTasks = ref([])
const requestGuard = createLatestRequestGuard(['remote'])
const remoteSyncRequests = new Map()
let syncTimer = null

const {
  activeTypeTasks,
  filteredTasks,
  selectedTask,
  countTasksByType,
  isActiveStatus,
  setActiveTaskType,
  setStatusFilter,
  setSearchKeyword,
  setSortOption,
  selectTask
} = useTaskCenterView({
  tasks: computed(() => tasks.value),
  activeTaskType,
  statusFilter,
  searchKeyword,
  sortOption,
  selectedTaskId,
  activeStatuses: ACTIVE_TASK_STATUSES
})

const typeOptions = computed(() => [
  { value: TaskType.DOWNLOAD, label: '下载', count: countTasksByType(TaskType.DOWNLOAD) },
  { value: TaskType.UPLOAD, label: '上传', count: countTasksByType(TaskType.UPLOAD) },
  { value: TaskType.DB_EXPORT, label: '数据库导出', count: countTasksByType(TaskType.DB_EXPORT) },
  { value: TaskType.SCAN, label: '扫描', count: countTasksByType(TaskType.SCAN) }
])

const statusOptions = computed(() => [
  { value: 'all', label: '全部', count: activeTypeTasks.value.length },
  { value: 'active', label: '进行中', count: activeTypeTasks.value.filter(isActiveStatus).length },
  ...[
    [TaskStatus.PENDING, '等待'],
    [TaskStatus.PAUSED, '暂停'],
    [TaskStatus.COMPLETED, '完成'],
    [TaskStatus.FAILED, '失败'],
    [TaskStatus.CANCELLED, '取消']
  ].map(([value, label]) => ({
    value,
    label,
    count: activeTypeTasks.value.filter(task => task.status === value).length
  }))
])

const selectedPrimaryAction = computed(() => getPrimaryTaskAction(selectedTask.value, iconMap))
const selectedSecondaryActions = computed(() =>
  getSecondaryTaskActions(selectedTask.value, iconMap)
)

const isCurrentSession = sessionId => sessionId === props.sessionId

const rebuildTaskList = (sessionId = props.sessionId) => {
  if (!sessionId || !isCurrentSession(sessionId)) return
  tasks.value = buildTaskList({
    localTasks: taskEngine.getTasksBySession(sessionId),
    serverDownloadTasks: serverDownloadTasks.value,
    serverUploadTasks: serverUploadTasks.value,
    serverSqlExportTasks: serverSqlExportTasks.value
  })
}

const syncRemoteTasks = (force = false) => {
  const sessionId = props.sessionId
  if (!sessionId) return
  if (!force && remoteSyncRequests.has(sessionId)) return remoteSyncRequests.get(sessionId)
  const request = (async () => {
    const sequence = requestGuard.next('remote')
    const [downloadResult, uploadResult, sqlResult] = await Promise.allSettled([
      downloadEngineTasksApi({ sessionId }),
      uploadEngineTasksApi({ sessionId }),
      getSqlExportTasksApi({ sessionId })
    ])
    if (!requestGuard.isCurrent('remote', sequence) || !isCurrentSession(sessionId)) return

    if (downloadResult.status === 'fulfilled') {
      const snapshots = Array.isArray(downloadResult.value?.data?.tasks)
        ? downloadResult.value.data.tasks
        : []
      serverDownloadTasks.value = snapshots
        .map(task => normalizeServerDownloadTask(task, sessionId))
        .filter(task => task.serverTaskId)
    }
    if (uploadResult.status === 'fulfilled') {
      const snapshots = Array.isArray(uploadResult.value?.data?.tasks)
        ? uploadResult.value.data.tasks
        : []
      serverUploadTasks.value = snapshots
        .map(task => normalizeServerUploadTask(task, sessionId))
        .filter(task => task.serverTaskId)
    }
    if (sqlResult.status === 'fulfilled') {
      const snapshots = Array.isArray(sqlResult.value?.data?.tasks)
        ? sqlResult.value.data.tasks
        : []
      serverSqlExportTasks.value = snapshots
        .map(task => normalizeServerSqlExportTask(task, sessionId))
        .filter(task => task.serverTaskId)
    }
    rebuildTaskList(sessionId)
  })()
  remoteSyncRequests.set(sessionId, request)
  request.finally(() => {
    if (remoteSyncRequests.get(sessionId) === request) remoteSyncRequests.delete(sessionId)
  })
  return request
}

const refreshAll = () => {
  syncRemoteTasks()
}

const resetSessionState = () => {
  requestGuard.invalidate()
  remoteSyncRequests.clear()
  selectedTaskId.value = ''
  tasks.value = []
  serverDownloadTasks.value = []
  serverUploadTasks.value = []
  serverSqlExportTasks.value = []
}

watch(
  () => props.sessionId,
  sessionId => {
    resetSessionState()
    if (!sessionId) return
    rebuildTaskList(sessionId)
    refreshAll()
  },
  { immediate: true }
)

const removeTask = async task => {
  const canRemoveServerTransfer =
    [TaskType.DOWNLOAD, TaskType.UPLOAD].includes(task?.type) && task?.serverTaskId
  if (!task?.taskId && !canRemoveServerTransfer) {
    showInfo('该任务仅存在于服务端快照')
    return
  }
  const confirmed = await confirmDelete({ title: '删除任务', message: '确定删除这个任务记录吗？' })
  if (!confirmed) return
  if (canRemoveServerTransfer) {
    const removeServerTask =
      task.type === TaskType.DOWNLOAD ? downloadEngineRemoveApi : uploadEngineRemoveApi
    await removeServerTask({ taskId: task.serverTaskId })
  }
  if (task.taskId) {
    taskEngine.removeTask(task.taskId)
  }
  await syncRemoteTasks(true)
  rebuildTaskList()
  showSuccess('任务已删除')
}

const downloadToLocal = async task => {
  const relativePath = getDownloadRelativePath(task?.downloadPath)
  if (!relativePath) {
    showError('服务端未返回可下载的相对路径')
    return
  }

  let url = ''
  let link = null
  try {
    const response = await downloadLocalFileApi({ path: relativePath, filename: task.fileName })
    url = URL.createObjectURL(response.data)
    link = document.createElement('a')
    link.href = url
    link.download = task.fileName || 'downloaded-file'
    document.body.appendChild(link)
    link.click()
  } catch (error) {
    showError(`下载失败: ${error?.message || '未知错误'}`)
  } finally {
    link?.remove()
    if (url) URL.revokeObjectURL(url)
  }
}

const handleTaskAction = async (action, task) => {
  if (!task) return
  const sessionId = task.sessionId || props.sessionId
  try {
    if (action === 'remove') return await removeTask(task)
    if (action === 'download') {
      if (task.status === TaskStatus.COMPLETED) await downloadToLocal(task)
      return
    }
    if (
      action === 'retry' &&
      !task.taskId &&
      [TaskType.DOWNLOAD, TaskType.UPLOAD].includes(task.type)
    ) {
      const retryServerTask =
        task.type === TaskType.DOWNLOAD ? downloadEngineRetryApi : uploadEngineRetryApi
      await retryServerTask({
        sessionId,
        taskId: task.serverTaskId
      })
      if (isCurrentSession(sessionId)) {
        showSuccess('任务已重新开始')
        await syncRemoteTasks(true)
      }
      return
    }
    if (
      !task.taskId &&
      [TaskType.DOWNLOAD, TaskType.UPLOAD].includes(task.type) &&
      task.serverTaskId
    ) {
      const isDownload = task.type === TaskType.DOWNLOAD
      const serverOperation = {
        pause: () =>
          (isDownload ? downloadEnginePauseApi : uploadEnginePauseApi)({
            taskId: task.serverTaskId
          }),
        resume: () =>
          (isDownload ? downloadEngineResumeApi : uploadEngineResumeApi)({
            sessionId,
            taskId: task.serverTaskId
          }),
        stop: () =>
          (isDownload ? downloadEngineCancelApi : uploadEngineCancelApi)({
            taskId: task.serverTaskId
          })
      }[action]
      if (!serverOperation) return
      await serverOperation()
      if (isCurrentSession(sessionId)) {
        showSuccess({ pause: '任务已暂停', resume: '任务已继续', stop: '任务已停止' }[action])
        await syncRemoteTasks(true)
      }
      return
    }
    if (!task.taskId) return

    const operation = {
      start: () => taskEngine.startTask(task.taskId),
      retry: () => taskEngine.retryTask(task.taskId),
      pause: () => taskEngine.pauseTask(task.taskId),
      resume: () => taskEngine.resumeTask(task.taskId),
      stop: () => taskEngine.stopTask(task.taskId)
    }[action]
    if (!operation) return
    await operation()
    if (!isCurrentSession(sessionId)) return
    showSuccess({
      start: '任务已开始',
      retry: '任务已重新开始',
      pause: '任务已暂停',
      resume: '任务已继续',
      stop: '任务已停止'
    }[action])
    rebuildTaskList(sessionId)
  } catch (error) {
    if (isCurrentSession(sessionId)) showError(error?.message || '任务操作失败')
  }
}

const taskEvents = [
  'taskProgress',
  'taskCompleted',
  'taskFailed',
  'taskPaused',
  'taskResumed',
  'taskCreated',
  'taskStarted',
  'taskCancelled',
  'taskRetried',
  'taskRemoved'
]
const handleTaskEngineChange = () => rebuildTaskList()

onMounted(() => {
  taskEvents.forEach(event => taskEngine.on(event, handleTaskEngineChange))
  syncTimer = window.setInterval(refreshAll, 3000)
})

onUnmounted(() => {
  requestGuard.invalidate()
  taskEvents.forEach(event => taskEngine.off(event, handleTaskEngineChange))
  if (syncTimer !== null) window.clearInterval(syncTimer)
  syncTimer = null
})
</script>

<style scoped>
.task-manager-page {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  color: var(--el-text-color-primary);
  --task-border: color-mix(in srgb, var(--el-border-color) 34%, transparent);
  --task-surface: color-mix(in srgb, var(--app-surface-background) 94%, var(--el-bg-color-overlay));
  --task-surface-strong: color-mix(in srgb, var(--app-card-background) 92%, var(--el-bg-color-overlay));
  --task-surface-muted: color-mix(in srgb, var(--app-control-background-soft) 92%, var(--el-bg-color-overlay));
}

.task-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(300px, 0.96fr);
  gap: var(--space-3);
  min-height: 0;
  flex: 1;
}

.task-main-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--task-border);
  border-radius: var(--radius-container);
  background: var(--task-surface);
}

.task-list {
  flex: 1;
  min-height: 0;
  padding: 0 var(--space-3) var(--space-3);
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.task-empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 280px;
  padding: 18px;
}

@media (max-width: 1200px) {
  .task-workspace {
    grid-template-columns: 1fr;
  }
}
</style>
