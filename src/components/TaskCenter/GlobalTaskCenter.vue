<template>
  <ManagerLayout
    title="全局任务中心"
    :icon="iconMap.task"
    module-class="global-task-center"
    hide-toolbar
    :initial-list-width="430"
    :list-min="360"
    :list-max="560"
  >
    <template #list>
      <div class="list-header">
        <div class="list-title-group">
          <span class="list-kicker">Task Directory</span>
          <h2>任务目录</h2>
        </div>
        <el-tooltip
          content="刷新任务"
          placement="top"
        >
          <button
            class="u-icon-btn"
            type="button"
            aria-label="刷新任务列表"
            :disabled="loading"
            @click="refreshTasks"
          >
            <el-icon :class="{ 'u-spin': loading }">
              <Icon :icon="iconMap.refresh" />
            </el-icon>
          </button>
        </el-tooltip>
      </div>

      <div class="summary-grid">
        <div class="summary-item">
          <span>全部</span>
          <strong>{{ summary.total }}</strong>
        </div>
        <div class="summary-item is-active">
          <span>进行中</span>
          <strong>{{ summary.active }}</strong>
        </div>
        <div class="summary-item is-success">
          <span>已完成</span>
          <strong>{{ summary.completed }}</strong>
        </div>
        <div class="summary-item is-danger">
          <span>失败</span>
          <strong>{{ summary.failed }}</strong>
        </div>
      </div>

      <div class="toolbar-stack">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索任务、主机、命令或路径"
          clearable
          size="small"
        >
          <template #prefix>
            <el-icon><Icon :icon="iconMap.search" /></el-icon>
          </template>
        </el-input>
        <div class="filter-row">
          <el-select
            v-model="typeFilter"
            size="small"
            aria-label="任务类型"
          >
            <el-option
              v-for="item in typeOptions"
              :key="item.value"
              :label="`${item.label} ${item.count}`"
              :value="item.value"
            />
          </el-select>
          <el-select
            v-model="statusFilter"
            size="small"
            aria-label="任务状态"
          >
            <el-option
              label="全部状态"
              value="all"
            />
            <el-option
              label="进行中"
              value="active"
            />
            <el-option
              label="已完成"
              value="completed"
            />
            <el-option
              label="失败"
              value="failed"
            />
            <el-option
              label="已取消"
              value="cancelled"
            />
          </el-select>
          <el-select
            v-model="sessionFilter"
            size="small"
            aria-label="主机会话"
          >
            <el-option
              label="全部主机"
              value="all"
            />
            <el-option
              label="平台任务"
              value="platform"
            />
            <el-option
              v-for="session in sessionOptions"
              :key="session.sessionId"
              :label="session.puppetName"
              :value="session.sessionId"
            />
          </el-select>
        </div>
      </div>

      <div class="list-scroll">
        <div
          v-if="loading && !filteredTasks.length"
          class="list-loading"
        >
          <el-skeleton
            :rows="8"
            animated
          />
        </div>

        <template v-else-if="filteredTasks.length">
          <article
            v-for="task in filteredTasks"
            :key="task.id"
            class="task-item"
            :class="{ 'is-active': selectedTask?.id === task.id }"
            tabindex="0"
            @click="selectedTaskId = task.id"
            @keydown.enter="selectedTaskId = task.id"
          >
            <div class="task-item__icon">
              <el-icon><Icon :icon="getTypeIcon(task.kind)" /></el-icon>
            </div>
            <div class="task-item__main">
              <div class="task-item__title-row">
                <strong>{{ task.title }}</strong>
                <StatusIndicator
                  :status="getIndicatorStatus(task.status)"
                  :label="getStatusText(task.status)"
                  compact
                />
              </div>
              <div class="task-item__meta">
                <span>{{ getTypeLabel(task.kind) }}</span>
                <span>{{ task.puppetName || '平台任务' }}</span>
                <span>{{ formatTime(task.updatedAt || task.startedAt) }}</span>
              </div>
              <el-progress
                v-if="isProgressVisible(task)"
                :percentage="clampProgress(task.progress)"
                :show-text="false"
                :stroke-width="5"
              />
            </div>
          </article>
        </template>

        <EmptyState
          v-else
          description="暂无符合条件的任务"
          compact
        />
      </div>
    </template>

    <template #detail>
      <section
        v-if="selectedTask"
        class="detail-card"
      >
        <DetailHeader
          :title="selectedTask.title"
          :icon="getTypeIcon(selectedTask.kind)"
          :description="selectedTask.puppetName || '平台级任务'"
          :tags="detailTags"
        >
          <template #badges>
            <StatusIndicator
              :status="getIndicatorStatus(selectedTask.status)"
              :label="getStatusText(selectedTask.status)"
            />
          </template>
          <template #meta>
            <div class="identity-id">
              <span>Task ID</span>
              <code>{{ selectedTask.taskId }}</code>
            </div>
          </template>
          <template #actions>
            <el-button
              v-if="selectedTask.sessionId"
              type="primary"
              plain
              @click="openTaskSession(selectedTask)"
            >
              <el-icon><Icon :icon="iconMap.server" /></el-icon>
              打开主机
            </el-button>
            <el-button
              v-if="canArchiveSelectedTask"
              :loading="archivingTaskId === selectedTask.id"
              @click="archiveSelectedTask"
            >
              <el-icon><Icon :icon="iconMap.save" /></el-icon>
              {{ isAiTask(selectedTask) ? '归档报告' : '归档输出' }}
            </el-button>
            <el-button
              v-if="selectedTask.cancellable"
              type="danger"
              :loading="cancellingTaskId === selectedTask.id"
              @click="cancelTask(selectedTask)"
            >
              <el-icon><Icon :icon="iconMap.stop" /></el-icon>
              停止任务
            </el-button>
          </template>
        </DetailHeader>

        <div class="detail-content">
          <div class="metrics-grid">
            <div class="metric-card">
              <span>任务类型</span>
              <strong>{{ getTypeLabel(selectedTask.kind) }}</strong>
            </div>
            <div class="metric-card">
              <span>当前状态</span>
              <strong>{{ getStatusText(selectedTask.status) }}</strong>
            </div>
            <div class="metric-card">
              <span>任务进度</span>
              <strong>{{ clampProgress(selectedTask.progress) }}%</strong>
            </div>
            <div class="metric-card">
              <span>更新时间</span>
              <strong>{{ formatTime(selectedTask.updatedAt || selectedTask.startedAt) }}</strong>
            </div>
          </div>

          <article class="info-panel">
            <div class="info-panel-header">
              任务上下文
            </div>
            <div class="kv-list">
              <div class="kv-item">
                <label>主机名称</label>
                <span>{{ selectedTask.puppetName || '-' }}</span>
              </div>
              <div class="kv-item">
                <label>Session ID</label>
                <code>{{ selectedTask.sessionId || '-' }}</code>
              </div>
              <div class="kv-item kv-item--full">
                <label>连接地址</label>
                <code>{{ selectedTask.connLink || '-' }}</code>
              </div>
              <div class="kv-item kv-item--full">
                <label>任务内容</label>
                <code>{{ selectedTask.detail || selectedTask.title || '-' }}</code>
              </div>
              <div
                v-if="selectedTask.currentStage"
                class="kv-item"
              >
                <label>当前阶段</label>
                <span>{{ formatTransferStage(selectedTask.currentStage) }}</span>
              </div>
              <div
                v-if="selectedTask.error"
                class="kv-item kv-item--full is-danger"
              >
                <label>
                  {{
                    selectedTask.errorStage
                      ? `错误阶段 · ${formatTransferStage(selectedTask.errorStage)}`
                      : '错误信息'
                  }}
                </label>
                <span>{{ selectedTask.error }}</span>
              </div>
            </div>
          </article>
        </div>
      </section>

      <EmptyState
        v-else
        workbench
        title="选择一个任务"
        description="从左侧选择任务，查看跨主机执行状态和上下文。"
        :icon="iconMap.task"
      />
    </template>
  </ManagerLayout>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { dayjs } from 'element-plus'

import ManagerLayout from '@/components/common/ManagerLayout.vue'
import DetailHeader from '@/components/common/DetailHeader.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import StatusIndicator from '@/components/common/StatusIndicator.vue'
import { taskEngine } from '@/components/PuppetConsole/File/TaskEngine.js'
import {
  globalTaskCenterCancelApi,
  globalTaskCenterSnapshotApi,
  puppetNodeAiThreadMessagesApi
} from '@/services/api.js'
import { platformAiMessagesApi } from '@/services/api/platform-ai.js'
import { confirmAction } from '@/utils/confirmUtils.js'
import { icons } from '@/utils/icons.js'
import { showError, showSuccess } from '@/utils/messageUtils.js'
import {
  ARTIFACT_CATEGORY,
  archiveTextArtifact,
  buildAiReportMarkdown,
  buildTaskResultMarkdown
} from '@/utils/artifactArchive.js'

const emit = defineEmits(['addPuppetEntity'])
const iconMap = icons

const loading = ref(false)
const cancellingTaskId = ref('')
const archivingTaskId = ref('')
const serverTasks = ref([])
const localRevision = ref(0)
const searchKeyword = ref('')
const typeFilter = ref('all')
const statusFilter = ref('all')
const sessionFilter = ref('all')
const selectedTaskId = ref('')
let refreshTimer = null
let loadErrorShown = false

const ACTIVE_STATUSES = new Set(['pending', 'running', 'paused'])
const ARCHIVABLE_STATUSES = new Set(['completed', 'failed', 'cancelled'])
const TASK_ENGINE_EVENTS = [
  'taskCreated',
  'taskStarted',
  'taskPaused',
  'taskResumed',
  'taskRetried',
  'taskProgress',
  'taskCompleted',
  'taskFailed',
  'taskCancelled',
  'taskRemoved'
]

const TYPE_META = {
  puppet_ai: { label: '节点 AI', icon: icons.chatAi },
  platform_ai: { label: '平台 AI', icon: icons.chatAi },
  download: { label: '文件下载', icon: icons.download },
  upload: { label: '文件上传', icon: icons.upload },
  db_export: { label: '数据库导出', icon: icons.database },
  scan: { label: '扫描任务', icon: icons.scan }
}

const STATUS_META = {
  idle: { label: '空闲', tone: 'info' },
  pending: { label: '等待中', tone: 'info' },
  running: { label: '执行中', tone: 'primary' },
  paused: { label: '已暂停', tone: 'warning' },
  completed: { label: '已完成', tone: 'success' },
  failed: { label: '失败', tone: 'danger' },
  cancelled: { label: '已取消', tone: 'info' }
}

const normalizeStatus = (status) => {
  const value = String(status || 'idle').toLowerCase()
  if (['uploading', 'downloading', 'db_exporting', 'scanning'].includes(value)) {
    return 'running'
  }
  if (['done', 'success'].includes(value)) return 'completed'
  if (['canceled', 'stopped'].includes(value)) return 'cancelled'
  return value
}

const clampProgress = (progress) => {
  const value = Number(progress || 0)
  return Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0
}

const formatTransferStage = stage =>
  ({
    CREATED: '已创建',
    PREPARING: '准备中',
    TRANSFERRING: '传输中',
    VERIFYING_REMOTE: '校验远端文件',
    VERIFYING_LOCAL: '校验本地文件',
    COMMITTING: '提交文件',
    FINISHED: '已结束'
  })[stage] || stage

const normalizeLocalTask = (task) => {
  const kind = task.type || 'task'
  const taskId = task.serverTaskId || task.engineTaskId || task.backendTaskId || task.id
  const status = normalizeStatus(task.status)
  return {
    id: `local:${task.id}`,
    localTaskId: task.id,
    source: 'browser',
    kind,
    taskId,
    sessionId: task.sessionId,
    puppetName: task.puppetName || task.sessionName || task.sessionId,
    connLink: task.connLink || '',
    title: task.fileName || task.command || task.targetLabel || task.databaseName || '浏览器任务',
    detail: task.command || task.filePath || task.serverPath || task.targetLabel || task.databaseName,
    result: task.result,
    resultSummary: task.resultSummary || task.summary,
    downloadPath: task.downloadPath || task.localPath,
    filePath: task.filePath,
    fileSize: task.fileSize,
    transferredBytes: task.downloadedSize || task.uploadedSize,
    status,
    progress: clampProgress(task.progress),
    startedAt: task.startTime || task.createdTime,
    finishedAt: task.endTime,
    updatedAt: task.endTime || task.startTime || task.createdTime,
    error: task.error || task.lastError,
    currentStage: task.currentStage,
    errorStage: task.errorStage,
    cancellable: ACTIVE_STATUSES.has(status) && task.canControl !== false
  }
}

const allTasks = computed(() => {
  localRevision.value
  const server = (serverTasks.value || []).map(task => ({
    ...task,
    status: normalizeStatus(task.status),
    progress: clampProgress(task.progress)
  }))
  const serverKeys = new Set(
    server.map(task => `${task.kind}:${task.sessionId || 'platform'}:${task.taskId}`)
  )
  const local = taskEngine.getAllTasks()
    .map(normalizeLocalTask)
    .filter(task => task.kind !== 'shell')
    .filter(task => !serverKeys.has(`${task.kind}:${task.sessionId || 'platform'}:${task.taskId}`))
  return [...server, ...local].sort(
    (a, b) => Number(b.updatedAt || b.startedAt || 0) - Number(a.updatedAt || a.startedAt || 0)
  )
})

const summary = computed(() => ({
  total: allTasks.value.length,
  active: allTasks.value.filter(task => ACTIVE_STATUSES.has(task.status)).length,
  completed: allTasks.value.filter(task => task.status === 'completed').length,
  failed: allTasks.value.filter(task => task.status === 'failed').length
}))

const typeOptions = computed(() => {
  const options = [{ value: 'all', label: '全部类型', count: allTasks.value.length }]
  Object.entries(TYPE_META).forEach(([value, meta]) => {
    const count = allTasks.value.filter(task => task.kind === value).length
    if (count > 0) options.push({ value, label: meta.label, count })
  })
  return options
})

const sessionOptions = computed(() => {
  const map = new Map()
  allTasks.value.forEach(task => {
    if (task.sessionId && !map.has(task.sessionId)) {
      map.set(task.sessionId, {
        sessionId: task.sessionId,
        puppetName: task.puppetName || task.sessionId
      })
    }
  })
  return [...map.values()].sort((a, b) => a.puppetName.localeCompare(b.puppetName, 'zh-Hans-CN'))
})

const filteredTasks = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  return allTasks.value.filter(task => {
    if (typeFilter.value !== 'all' && task.kind !== typeFilter.value) return false
    if (statusFilter.value === 'active' && !ACTIVE_STATUSES.has(task.status)) return false
    if (!['all', 'active'].includes(statusFilter.value) && task.status !== statusFilter.value) return false
    if (sessionFilter.value === 'platform' && task.sessionId) return false
    if (!['all', 'platform'].includes(sessionFilter.value) && task.sessionId !== sessionFilter.value) return false
    if (!keyword) return true
    return [task.title, task.detail, task.taskId, task.puppetName, task.connLink]
      .some(value => String(value || '').toLowerCase().includes(keyword))
  })
})

const selectedTask = computed(() =>
  filteredTasks.value.find(task => task.id === selectedTaskId.value) || null
)

const canArchiveSelectedTask = computed(() => {
  return !!selectedTask.value && ARCHIVABLE_STATUSES.has(selectedTask.value.status)
})

const detailTags = computed(() => selectedTask.value
  ? [
      { label: getTypeLabel(selectedTask.value.kind), type: 'info' }
    ]
  : [])

watch(filteredTasks, (tasks) => {
  if (!tasks.some(task => task.id === selectedTaskId.value)) {
    selectedTaskId.value = tasks[0]?.id || ''
  }
}, { immediate: true })

const getTypeLabel = (kind) => TYPE_META[kind]?.label || kind || '未知任务'
const isAiTask = (task) => ['platform_ai', 'puppet_ai'].includes(task?.kind)
const getTypeIcon = (kind) => TYPE_META[kind]?.icon || icons.task
const getStatusText = (status) => STATUS_META[status]?.label || status || '未知'
const getIndicatorStatus = (status) => ({
  idle: 'untested',
  pending: 'waiting',
  running: 'running',
  paused: 'warning',
  completed: 'success',
  failed: 'failed',
  cancelled: 'disabled'
}[status] || 'untested')
const isProgressVisible = (task) => ACTIVE_STATUSES.has(task.status) || clampProgress(task.progress) > 0
const formatTime = (value) => value ? dayjs(Number(value)).format('MM-DD HH:mm:ss') : '-'

const refreshTasks = async () => {
  if (loading.value) return
  loading.value = true
  try {
    const response = await globalTaskCenterSnapshotApi()
    serverTasks.value = response.data?.tasks || []
    loadErrorShown = false
  } catch (error) {
    if (!loadErrorShown) {
      showError('加载全局任务失败：' + (error?.message || '未知错误'))
      loadErrorShown = true
    }
  } finally {
    loading.value = false
  }
}

const cancelTask = async (task) => {
  const confirmed = await confirmAction({
    title: '停止任务',
    message: `确定停止“${task.title}”吗？`,
    type: 'warning'
  })
  if (!confirmed) return

  cancellingTaskId.value = task.id
  try {
    if (task.source === 'browser' && task.localTaskId) {
      await taskEngine.stopTask(task.localTaskId)
      localRevision.value += 1
    } else {
      await globalTaskCenterCancelApi({
        kind: task.kind,
        sessionId: task.sessionId,
        taskId: task.taskId
      })
    }
    showSuccess('任务已停止')
    await refreshTasks()
  } catch (error) {
    showError('停止任务失败：' + (error?.message || '未知错误'))
  } finally {
    cancellingTaskId.value = ''
  }
}

const openTaskSession = (task) => {
  if (!task.sessionId) return
  emit('addPuppetEntity', {
    puppetName: task.puppetName || task.sessionId,
    sessionId: task.sessionId,
    connLink: task.connLink || ''
  })
}

const archiveSelectedTask = async () => {
  const task = selectedTask.value
  if (!task || !canArchiveSelectedTask.value || archivingTaskId.value) return
  archivingTaskId.value = task.id
  try {
    if (['platform_ai', 'puppet_ai'].includes(task.kind)) {
      const isPlatform = task.kind === 'platform_ai'
      const response = isPlatform
        ? await platformAiMessagesApi({ threadId: task.taskId, offset: 0, limit: 1000 })
        : await puppetNodeAiThreadMessagesApi({
            sessionId: task.sessionId,
            threadId: task.taskId,
            offset: 0,
            limit: 1000
          })
      const messages = response.data?.messages || []
      await archiveTextArtifact({
        category: ARTIFACT_CATEGORY.AI_REPORTS,
        name: `${isPlatform ? '平台' : '节点'}-${task.title}`,
        extension: 'md',
        mimeType: 'text/markdown;charset=utf-8',
        content: buildAiReportMarkdown({
          title: task.title,
          scope: isPlatform ? '平台 AI 分析' : '节点 AI 分析',
          threadId: task.taskId,
          sessionId: task.sessionId,
          hostName: task.puppetName,
          messages
        })
      })
      showSuccess('AI 分析报告已归档到成果库')
      return
    }
    await archiveTextArtifact({
      category: ARTIFACT_CATEGORY.TASK_RESULTS,
      name: `${getTypeLabel(task.kind)}-${task.title}`,
      extension: 'md',
      mimeType: 'text/markdown;charset=utf-8',
      content: buildTaskResultMarkdown(task, {
        typeLabel: getTypeLabel(task.kind),
        statusLabel: getStatusText(task.status)
      })
    })
    showSuccess('任务输出已归档到成果库')
  } catch (error) {
    showError('归档任务输出失败：' + (error?.message || '未知错误'))
  } finally {
    archivingTaskId.value = ''
  }
}

const onTaskEngineChanged = () => {
  localRevision.value += 1
}

const onVisibilityChange = () => {
  if (!document.hidden) refreshTasks()
}

onMounted(() => {
  TASK_ENGINE_EVENTS.forEach(event => taskEngine.on(event, onTaskEngineChanged))
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('online', refreshTasks)
  refreshTasks()
  refreshTimer = window.setInterval(() => {
    if (!document.hidden) refreshTasks()
  }, 5000)
})

onUnmounted(() => {
  TASK_ENGINE_EVENTS.forEach(event => taskEngine.off(event, onTaskEngineChanged))
  document.removeEventListener('visibilitychange', onVisibilityChange)
  window.removeEventListener('online', refreshTasks)
  if (refreshTimer) window.clearInterval(refreshTimer)
})
</script>

<style scoped>
.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 42px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--panel-border-color);
}

.list-title-group h2 {
  margin: 2px 0 0;
  font-size: 14px;
}

.list-kicker {
  color: var(--el-text-color-placeholder);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  padding: 10px 12px 4px;
}

.summary-item {
  min-width: 0;
  padding: 8px 9px;
  border-radius: 0;
  background: transparent;
  border: 0;
  border-right: 1px solid var(--app-divider-color);
}

.summary-item:last-child { border-right: 0; }

.summary-item span,
.summary-item strong {
  display: block;
}

.summary-item span {
  color: var(--el-text-color-secondary);
  font-size: 10px;
}

.summary-item strong {
  margin-top: 2px;
  font-size: 17px;
}

.summary-item.is-active strong { color: var(--el-color-primary); }
.summary-item.is-success strong { color: var(--el-color-success); }
.summary-item.is-danger strong { color: var(--el-color-danger); }

.toolbar-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
}

.filter-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.list-scroll {
  height: calc(100% - 188px);
  min-height: 0;
  overflow-y: auto;
  padding: 4px 8px 12px;
}

.task-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 6px;
  padding: 10px 11px;
  border: 1px solid transparent;
  border-radius: var(--radius-control);
  background: var(--app-card-background);
  cursor: pointer;
  transition: background var(--motion-fast), border-color var(--motion-fast);
}

.task-item:hover {
  background: var(--list-item-hover-bg);
  border-color: var(--list-item-hover-border);
}

.task-item.is-active {
  background: var(--list-item-active-bg);
  border-color: var(--list-item-active-border);
}

.task-item:focus-visible {
  outline: var(--focus-outline);
  outline-offset: var(--focus-outline-offset);
}

.task-item__icon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: var(--radius-control);
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 8%, var(--app-control-background));
}

.task-item__main {
  min-width: 0;
  flex: 1;
}

.task-item__title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.task-item__title-row strong {
  min-width: 0;
  overflow: hidden;
  color: var(--el-text-color-primary);
  font-size: 12px;
  line-height: 1.5;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-item__meta {
  display: flex;
  gap: 8px;
  margin: 4px 0 7px;
  overflow: hidden;
  color: var(--el-text-color-secondary);
  font-size: 10px;
  white-space: nowrap;
}

.detail-card {
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  background: var(--app-card-background);
}

.identity-id span,
.identity-id code {
  display: block;
}

.identity-id span {
  margin-bottom: 3px;
  color: var(--el-text-color-secondary);
  font-size: 10px;
}

.identity-id code {
  max-width: 380px;
  overflow: hidden;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-content {
  padding: 16px;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}

.metric-card,
.kv-item {
  min-width: 0;
  padding: 12px;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 34%, transparent);
  border-radius: var(--radius-control);
  background: var(--app-control-background-soft);
}

.metric-card span,
.metric-card strong,
.kv-item label,
.kv-item span,
.kv-item code {
  display: block;
}

.metric-card span,
.kv-item label {
  margin-bottom: 5px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.metric-card strong,
.kv-item span,
.kv-item code {
  overflow-wrap: anywhere;
  color: var(--el-text-color-primary);
  font-size: 12px;
  line-height: 1.6;
}

.info-panel {
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 34%, transparent);
  border-radius: 8px;
}

.info-panel-header {
  padding: 10px 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 28%, transparent);
  font-size: 12px;
  font-weight: 700;
}

.kv-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding: 12px;
}

.kv-item--full {
  grid-column: 1 / -1;
}

.kv-item.is-danger {
  border-color: color-mix(in srgb, var(--el-color-danger) 36%, transparent);
  background: color-mix(in srgb, var(--el-color-danger) 6%, var(--app-control-background-soft));
}

@media (max-width: 1100px) {
  .metrics-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .filter-row,
  .metrics-grid,
  .kv-list {
    grid-template-columns: 1fr;
  }

  .kv-item--full {
    grid-column: auto;
  }
}
</style>
