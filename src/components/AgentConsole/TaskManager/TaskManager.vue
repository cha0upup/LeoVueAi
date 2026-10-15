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
      @update:type="activeTaskType = $event"
      @update:status="statusFilter = $event"
      @update:search="searchKeyword = $event"
      @update:sort="sortOption = $event"
    >
      <template #sync>
        <span
          v-if="lastSyncedAt"
          class="sync-time"
          :title="`上次任务状态同步：${new Date(lastSyncedAt).toLocaleString()}`"
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
        <el-button
          v-if="hasMoreScanHistory && ['all', TaskType.SCAN].includes(activeTaskType)"
          class="scan-history-more"
          title="扫描筛选与搜索仅包含已加载的历史记录"
          text
          type="primary"
          :loading="loadingMoreScans"
          @click="loadMoreScanTasks"
        >
          加载更多扫描历史
        </el-button>
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
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, toRef, watch } from 'vue'
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
  uploadEngineCancelApi,
  uploadEnginePauseApi,
  uploadEngineRemoveApi,
  uploadEngineResumeApi,
  uploadEngineRetryApi,
  uploadEngineTasksApi
} from '@/services/api/agent-files.js'
import { deleteNetworkProbeWorkflowApi } from '@/services/api/scan.js'
import { getSqlExportTasksApi } from '@/services/api/sql.js'
import { useAssetDiscoveryTasks } from '../Scan/useAssetDiscoveryTasks.js'
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
const refreshRequest = shallowRef(null)
const isSyncing = computed(() => Boolean(refreshRequest.value))
const initialSyncDone = ref(false)
const lastSyncedAt = ref(0)
const remoteErrors = ref([])
const {
  tasks: scanTasks,
  selectedTaskId: selectedScanTaskId,
  loadError: scanLoadError,
  hasMoreHistory: hasMoreScanHistory,
  loadingMore: loadingMoreScans,
  loadMoreTasks: loadMoreScanTasks,
  syncTasks: syncScanTasks
} = useAssetDiscoveryTasks({
  sessionId: toRef(props, 'sessionId'), taskEngine, autoSelect: false, pollIntervalMs: 0
})
const syncError = computed(() =>
  [...remoteErrors.value, ...(scanLoadError.value ? ['扫描'] : [])].join('、')
)

const {
  activeTypeTasks,
  filteredTasks,
  selectedTask,
  isActiveStatus
} = useTaskCenterView({
  tasks,
  activeTaskType,
  statusFilter,
  searchKeyword,
  sortOption,
  selectedTaskId,
  activeStatuses: ACTIVE_TASK_STATUSES
})

const typeOptions = computed(() => {
  const counts = new Map()
  for (const { type } of tasks.value) counts.set(type, (counts.get(type) || 0) + 1)
  return [
    { value: 'all', label: '全部类型', count: tasks.value.length },
    ...[
      [TaskType.DOWNLOAD, '下载'], [TaskType.UPLOAD, '上传'],
      [TaskType.DB_EXPORT, '数据库导出'], [TaskType.SCAN, '扫描']
    ].map(([value, label]) => ({ value, label, count: counts.get(value) || 0 }))
  ]
})

const statusOptions = computed(() => {
  const counts = new Map()
  let activeCount = 0
  for (const task of activeTypeTasks.value) {
    counts.set(task.status, (counts.get(task.status) || 0) + 1)
    if (isActiveStatus(task)) activeCount += 1
  }
  return [
    { value: 'all', label: '全部状态', count: activeTypeTasks.value.length },
    { value: 'active', label: '进行中', count: activeCount },
    ...[
      [TaskStatus.PENDING, '等待'], [TaskStatus.PAUSED, '暂停'],
      [TaskStatus.COMPLETED, '完成'], [TaskStatus.FAILED, '失败'], [TaskStatus.CANCELLED, '取消']
    ].map(([value, label]) => ({ value, label, count: counts.get(value) || 0 }))
  ]
})

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
  selectedTaskId.value = viewId
}
function closeDetail() {
  selectedTaskId.value = ''
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
    const sources = [
      { label: '下载', api: downloadEngineTasksApi, tasks: serverDownloadTasks, normalize: normalizeServerDownloadTask },
      { label: '上传', api: uploadEngineTasksApi, tasks: serverUploadTasks, normalize: normalizeServerUploadTask },
      { label: '数据库导出', api: getSqlExportTasksApi, tasks: serverSqlExportTasks,
        normalize: task => normalizeServerSqlExportTask(task, sessionId) }
    ]
    const results = await Promise.allSettled(sources.map(source => source.api({ sessionId })))
    if (!requestGuard.isCurrent('remote', sequence) || !isCurrentSession(sessionId)) return
    remoteErrors.value = sources
      .filter((_, index) => results[index].status === 'rejected')
      .map(source => source.label)
    for (const [index, source] of sources.entries()) {
      const result = results[index]
      if (result.status !== 'fulfilled') continue
      const snapshots = Array.isArray(result.value?.data?.tasks) ? result.value.data.tasks : []
      source.tasks.value = snapshots.map(source.normalize).filter(task => task.serverTaskId)
    }
    rebuildTaskList(sessionId)
  })()
  remoteSyncRequests.set(sessionId, request)
  request.finally(() => {
    if (remoteSyncRequests.get(sessionId) === request) remoteSyncRequests.delete(sessionId)
  })
  return request
}

watch(scanTasks, () => rebuildTaskList())
watch(selectedTask, task => {
  selectedScanTaskId.value = task?.type === TaskType.SCAN ? task.taskId : null
})

const refreshAll = ({ discover = true } = {}) => {
  if (refreshRequest.value) return refreshRequest.value
  const sessionId = props.sessionId
  if (!sessionId) return
  const sequence = requestGuard.next('refresh')
  const request = Promise.allSettled([
    syncRemoteTasks(),
    syncScanTasks({ discover })
  ])
    .then(([remote]) => {
      if (!requestGuard.isCurrent('refresh', sequence) || !isCurrentSession(sessionId)) return
      if (remote.status === 'rejected') remoteErrors.value = ['下载', '上传', '数据库导出']
      initialSyncDone.value = true
      if (!syncError.value) lastSyncedAt.value = Date.now()
      rebuildTaskList(sessionId)
    })
    .finally(() => {
      if (refreshRequest.value === request) refreshRequest.value = null
    })
  refreshRequest.value = request
  return request
}

const resetSessionState = () => {
  requestGuard.invalidate()
  remoteSyncRequests.clear()
  refreshRequest.value = null
  initialSyncDone.value = false
  lastSyncedAt.value = 0
  remoteErrors.value = []
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
    await syncScanTasks()
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

const TASK_ACTIONS = {
  start: { method: 'startTask', message: '任务已开始' },
  retry: { method: 'retryTask', message: '任务已重新开始' },
  pause: { method: 'pauseTask', message: '任务已暂停' },
  resume: { method: 'resumeTask', message: '任务已继续' },
  stop: { method: 'stopTask', message: '任务已停止' }
}
const SERVER_TRANSFER_ACTIONS = {
  [TaskType.DOWNLOAD]: {
    retry: downloadEngineRetryApi,
    pause: downloadEnginePauseApi,
    resume: downloadEngineResumeApi,
    stop: downloadEngineCancelApi
  },
  [TaskType.UPLOAD]: {
    retry: uploadEngineRetryApi,
    pause: uploadEnginePauseApi,
    resume: uploadEngineResumeApi,
    stop: uploadEngineCancelApi
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
    const taskAction = TASK_ACTIONS[action]
    if (!taskAction) return
    if (
      !task.taskId &&
      [TaskType.DOWNLOAD, TaskType.UPLOAD].includes(task.type)
    ) {
      const operation = SERVER_TRANSFER_ACTIONS[task.type][action]
      if (!operation || (action !== 'retry' && !task.serverTaskId)) return
      const parameters = { taskId: task.serverTaskId }
      if (action === 'retry' || action === 'resume') parameters.sessionId = sessionId
      await operation(parameters)
      if (isCurrentSession(sessionId)) {
        showSuccess(taskAction.message)
        await syncRemoteTasks(true)
      }
      return
    }
    if (!task.taskId) return

    await taskEngine[taskAction.method](task.taskId)
    if (!isCurrentSession(sessionId)) return
    showSuccess(taskAction.message)
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
  syncTimer = window.setInterval(() => refreshAll({ discover: false }), 3000)
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
.scan-history-more {
  flex-shrink: 0;
  margin: 4px 12px;
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
