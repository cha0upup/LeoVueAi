<template>
  <div
    ref="workspaceRef"
    class="task-manager-page"
  >
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
    >
      <template #sync>
        <span
          v-if="lastSyncedAt"
          class="sync-time"
          :title="`上次完整同步：${new Date(lastSyncedAt).toLocaleString()}`"
        >
          更新于 {{ new Date(lastSyncedAt).toLocaleTimeString('zh-CN', { hour12: false }) }}
        </span>
        <el-button
          text
          size="small"
          :loading="isSyncing"
          :disabled="isSyncing"
          @click="refreshAll"
        >
          刷新
        </el-button>
      </template>
    </TaskManagerFilters>
    <div
      v-if="syncError"
      class="sync-error"
      role="alert"
    >
      {{ syncError }}任务同步失败，已有记录已保留。可点击刷新重试。
    </div>
    <div
      class="task-workspace"
      :class="{ 'has-detail': selectedTask && !isCompact }"
    >
      <section
        class="task-main-panel"
        aria-label="任务列表"
        :aria-busy="isSyncing && !initialSyncDone"
      >
        <div
          v-if="!filteredTasks.length"
          class="task-empty-state"
          role="status"
        >
          <Icon
            :icon="
              !initialSyncDone
                ? 'mdi:progress-clock'
                : syncError
                  ? 'mdi:cloud-alert-outline'
                  : 'mdi:clipboard-text-outline'
            "
          />
          <strong>{{ emptyState.title }}</strong>
          <p>{{ emptyState.hint }}</p>
          <el-button
            v-if="initialSyncDone && !syncError && tasks.length && hasFilters"
            size="small"
            @click="resetFilters"
          >
            {{ activeTypeTasks.length ? '清除筛选' : '查看全部任务' }}
          </el-button>
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
            @select="openDetail(task.viewId, $event)"
            @action="handleTaskAction($event, task)"
          />
        </div>
      </section>
      <section
        v-if="selectedTask && !isCompact"
        class="task-detail-shell"
        aria-label="任务详情"
      >
        <div class="detail-heading">
          <strong>任务详情</strong>
          <el-button
            text
            size="small"
            aria-label="关闭任务详情"
            @click="closeDetail"
          >
            <Icon icon="mdi:close" />
          </el-button>
        </div>
        <TaskManagerDetail
          :task="selectedTask"
          :primary-action="selectedPrimaryAction"
          :secondary-actions="selectedSecondaryActions"
          @action="handleTaskAction($event, selectedTask)"
        />
      </section>
    </div>
    <el-drawer
      v-if="isCompact"
      :model-value="Boolean(selectedTask)"
      title="任务详情"
      size="min(420px, 100%)"
      :append-to-body="false"
      :modal-append-to-body="false"
      :lock-scroll="false"
      @close="closeDetail"
      @closed="restoreDetailFocus"
    >
      <TaskManagerDetail
        v-if="selectedTask"
        :task="selectedTask"
        :primary-action="selectedPrimaryAction"
        :secondary-actions="selectedSecondaryActions"
        @action="handleTaskAction($event, selectedTask)"
      />
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { confirmDelete } from '@/utils/confirmUtils.js'
import { icons } from '@/utils/icons.js'
import { downloadBlob } from '@/utils/downloadBlob.js'
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
  deleteNetworkProbeWorkflowApi,
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
const activeTaskType = ref('all')
const statusFilter = ref('all')
const searchKeyword = ref('')
const sortOption = ref('latest')
const selectedTaskId = ref('')
const tasks = ref([])
const serverDownloadTasks = ref([])
const serverUploadTasks = ref([])
const serverSqlExportTasks = ref([])
const requestGuard = createLatestRequestGuard(['remote', 'refresh'])
const remoteSyncRequests = new Map()
let syncTimer = null
const workspaceRef = ref(null)
const isCompact = ref(false)
let resizeObserver = null
let detailTrigger = null
let refreshRequest = null
const isSyncing = ref(false)
const initialSyncDone = ref(false)
const lastSyncedAt = ref(0)
const remoteErrors = ref([])
const scanSyncFailed = ref(false)
const syncError = computed(() =>
  [...remoteErrors.value, ...(scanSyncFailed.value ? ['扫描'] : [])].join('、')
)

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
  { value: 'all', label: '全部类型', count: tasks.value.length },
  { value: TaskType.DOWNLOAD, label: '下载', count: countTasksByType(TaskType.DOWNLOAD) },
  { value: TaskType.UPLOAD, label: '上传', count: countTasksByType(TaskType.UPLOAD) },
  { value: TaskType.DB_EXPORT, label: '数据库导出', count: countTasksByType(TaskType.DB_EXPORT) },
  { value: TaskType.SCAN, label: '扫描', count: countTasksByType(TaskType.SCAN) }
])

const statusOptions = computed(() => [
  { value: 'all', label: '全部状态', count: activeTypeTasks.value.length },
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
    count: activeTypeTasks.value.filter((task) => task.status === value).length
  }))
])

const selectedPrimaryAction = computed(() => getPrimaryTaskAction(selectedTask.value, iconMap))
const selectedSecondaryActions = computed(() =>
  getSecondaryTaskActions(selectedTask.value, iconMap)
)

const hasFilters = computed(
  () =>
    activeTaskType.value !== 'all' ||
    statusFilter.value !== 'all' ||
    Boolean(searchKeyword.value.trim())
)
const emptyState = computed(() => {
  if (!initialSyncDone.value) return { title: '正在加载任务', hint: '正在同步当前节点的任务记录…' }
  if (syncError.value)
    return { title: '暂时没有可展示的任务', hint: '部分任务未能获取，请刷新后重试。' }
  if (!tasks.value.length)
    return { title: '暂无任务', hint: '下载、上传、数据库导出和扫描任务会显示在这里。' }
  if (!activeTypeTasks.value.length) {
    const label =
      typeOptions.value.find((option) => option.value === activeTaskType.value)?.label || ''
    return { title: `暂无${label}任务`, hint: '可以切换到全部类型查看其他任务。' }
  }
  return { title: '没有匹配的任务', hint: '请调整状态或关键词，也可以清除筛选。' }
})
function resetFilters() {
  activeTaskType.value = 'all'
  statusFilter.value = 'all'
  searchKeyword.value = ''
}
function openDetail(viewId, event) {
  detailTrigger = event?.currentTarget
  selectTask(viewId)
}
function closeDetail() {
  selectTask('')
  if (!isCompact.value) restoreDetailFocus()
}
function restoreDetailFocus() {
  nextTick(() => detailTrigger?.isConnected && detailTrigger.focus())
}

const isCurrentSession = (sessionId) => sessionId === props.sessionId

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
    remoteErrors.value = ['下载', '上传', '数据库导出'].filter(
      (_, index) => [downloadResult, uploadResult, sqlResult][index].status === 'rejected'
    )

    if (downloadResult.status === 'fulfilled') {
      const snapshots = Array.isArray(downloadResult.value?.data?.tasks)
        ? downloadResult.value.data.tasks
        : []
      serverDownloadTasks.value = snapshots
        .map((task) => normalizeServerDownloadTask(task))
        .filter((task) => task.serverTaskId)
    }
    if (uploadResult.status === 'fulfilled') {
      const snapshots = Array.isArray(uploadResult.value?.data?.tasks)
        ? uploadResult.value.data.tasks
        : []
      serverUploadTasks.value = snapshots
        .map((task) => normalizeServerUploadTask(task))
        .filter((task) => task.serverTaskId)
    }
    if (sqlResult.status === 'fulfilled') {
      const snapshots = Array.isArray(sqlResult.value?.data?.tasks)
        ? sqlResult.value.data.tasks
        : []
      serverSqlExportTasks.value = snapshots
        .map((task) => normalizeServerSqlExportTask(task, sessionId))
        .filter((task) => task.serverTaskId)
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
  if (refreshRequest) return refreshRequest
  const sessionId = props.sessionId
  if (!sessionId) return
  const sequence = requestGuard.next('refresh')
  isSyncing.value = true
  const request = Promise.allSettled([
    syncRemoteTasks(),
    taskEngine.syncNetworkWorkflowTasks(sessionId)
  ])
    .then(([remote, scan]) => {
      if (!requestGuard.isCurrent('refresh', sequence) || !isCurrentSession(sessionId)) return
      if (remote.status === 'rejected') remoteErrors.value = ['下载', '上传', '数据库导出']
      scanSyncFailed.value = scan.status === 'rejected'
      initialSyncDone.value = true
      isSyncing.value = false
      if (!syncError.value) lastSyncedAt.value = Date.now()
      rebuildTaskList(sessionId)
    })
    .finally(() => {
      if (refreshRequest === request) refreshRequest = null
    })
  refreshRequest = request
  return request
}

const resetSessionState = () => {
  requestGuard.invalidate()
  remoteSyncRequests.clear()
  refreshRequest = null
  isSyncing.value = false
  initialSyncDone.value = false
  lastSyncedAt.value = 0
  remoteErrors.value = []
  scanSyncFailed.value = false
  selectedTaskId.value = ''
  tasks.value = []
  serverDownloadTasks.value = []
  serverUploadTasks.value = []
  serverSqlExportTasks.value = []
}

watch(
  () => props.sessionId,
  (sessionId) => {
    resetSessionState()
    if (!sessionId) return
    rebuildTaskList(sessionId)
    refreshAll()
  },
  { immediate: true }
)

const removeTask = async (task) => {
  const isNetworkWorkflow =
    task?.type === TaskType.SCAN &&
    task?.scanKind === 'network_workflow' &&
    task?.backendTaskId
  const canRemoveServerTransfer =
    [TaskType.DOWNLOAD, TaskType.UPLOAD].includes(task?.type) && task?.serverTaskId
  if (!task?.taskId && !canRemoveServerTransfer && !isNetworkWorkflow) {
    showInfo('该任务仅存在于服务端快照')
    return
  }
  const confirmed = await confirmDelete({ title: '删除任务', message: '确定删除这个任务记录吗？' })
  if (!confirmed) return
  if (isNetworkWorkflow) {
    await deleteNetworkProbeWorkflowApi({
      sessionId: task.sessionId || props.sessionId,
      taskId: task.backendTaskId
    })
    if (task.taskId) taskEngine.removeTaskById(task.taskId)
    await taskEngine.syncNetworkWorkflowTasks(task.sessionId || props.sessionId)
    rebuildTaskList()
    showSuccess('任务已删除')
    return
  }
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

const downloadToLocal = async (task) => {
  const relativePath = getDownloadRelativePath(task?.downloadPath)
  if (!relativePath) {
    showError('服务端未返回可下载的相对路径')
    return
  }

  try {
    const response = await downloadLocalFileApi({ path: relativePath, filename: task.fileName })
    downloadBlob(response.data, task.fileName || 'downloaded-file')
  } catch (error) {
    showError(`下载失败: ${error?.message || '未知错误'}`)
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
    showSuccess(
      {
        start: '任务已开始',
        retry: '任务已重新开始',
        pause: '任务已暂停',
        resume: '任务已继续',
        stop: '任务已停止'
      }[action]
    )
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
  resizeObserver = new ResizeObserver(([entry]) => {
    isCompact.value = entry.contentRect.width < 820
  })
  resizeObserver.observe(workspaceRef.value)
  taskEvents.forEach((event) => taskEngine.on(event, handleTaskEngineChange))
  syncTimer = window.setInterval(refreshAll, 3000)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  requestGuard.invalidate()
  taskEvents.forEach((event) => taskEngine.off(event, handleTaskEngineChange))
  if (syncTimer !== null) window.clearInterval(syncTimer)
  syncTimer = null
})
</script>

<style scoped>
.task-manager-page {
  display: flex;
  position: relative;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  height: 100%;
  overflow: hidden;
  color: var(--el-text-color-primary);
  background: var(--el-bg-color);
  container-type: inline-size;
}
.task-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  flex: 1;
  min-height: 0;
}
.task-workspace.has-detail {
  grid-template-columns: minmax(0, 1fr) minmax(320px, 38%);
}
.task-main-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}
.task-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.task-empty-state {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: auto;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 10px;
  padding: 24px;
  font-size: 12px;
  text-align: center;
  color: var(--el-text-color-secondary);
}
.task-empty-state > svg {
  font-size: 32px;
  color: var(--el-text-color-placeholder);
}
.task-empty-state strong {
  font-weight: 500;
  font-size: 14px;
  color: var(--el-text-color-regular);
}
.task-empty-state p {
  margin: 0;
  line-height: 1.7;
}
.sync-error {
  flex-shrink: 0;
  padding: 8px 12px;
  color: var(--el-color-danger);
  background: color-mix(in srgb, var(--el-color-danger) 8%, var(--el-bg-color));
  font-size: 12px;
  line-height: 1.6;
}
.task-detail-shell {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  border-left: 1px solid var(--el-border-color-lighter);
}
.detail-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  padding: 8px 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  font-size: 12px;
}
.task-manager-page :deep(.el-overlay) {
  position: absolute;
}
.task-manager-page :deep(.el-drawer__header) {
  margin: 0;
  padding: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.task-manager-page :deep(.el-drawer__body) {
  display: flex;
  min-height: 0;
  padding: 0;
}
@container (max-width: 520px) {
  .sync-time {
    display: none;
  }
}
</style>
