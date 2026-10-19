<template>
  <div class="asset-discovery-view">
    <header
      class="page-head"
      :class="{ 'has-tasks': tasks.length }"
    >
      <div class="task-selector">
        <div class="selector-label">
          <span class="selector-caption">{{ tasks.length ? '当前扫描' : '网络资产发现' }}</span>
          <span
            v-if="tasks.length"
            class="selector-count"
          >已加载 {{ tasks.length }} 个任务</span>
        </div>
        <el-select
          v-if="tasks.length"
          v-model="selectedTaskId"
          class="task-select"
          filterable
          placeholder="选择一个扫描任务"
          no-data-text="暂无扫描任务"
          no-match-text="未匹配已加载任务，可继续加载历史"
          @change="selectTask"
        >
          <el-option
            v-for="task in tasks"
            :key="task.id"
            :label="task.name || task.targetLabel || '未命名扫描'"
            :value="task.id"
          >
            <div class="task-option">
              <span class="task-option-name">{{ task.name || task.targetLabel || '未命名扫描' }}</span>
              <span class="task-option-meta">{{ TASK_STATUS_TEXT[task.status] }} · {{ formatCount(task.targetCount) }} 个目标</span>
            </div>
          </el-option>
          <template
            v-if="hasMoreHistory"
            #footer
          >
            <el-button
              text
              type="primary"
              :loading="loadingMore"
              :disabled="historyLoading && !loadingMore"
              @click.stop="loadMoreTasks"
            >
              加载更多历史任务
            </el-button>
          </template>
        </el-select>
        <div
          v-if="activeTask"
          class="selector-task-meta"
        >
          <span
            class="status-mark"
            :class="`status-${activeTask.status}`"
          />
          <span>{{ TASK_STATUS_TEXT[activeTask.status] }}</span>
          <span class="meta-divider" />
          <span>{{ shortTaskId(activeBackendTaskId) }}</span>
        </div>
      </div>
      <div class="head-actions">
        <el-button
          :icon="Refresh"
          :loading="historyLoading"
          @click="syncTasks"
        >
          刷新
        </el-button>
        <el-button
          v-if="tasks.length || loadError"
          type="primary"
          :icon="Plus"
          @click="showComposer = true"
        >
          新建扫描
        </el-button>
      </div>
    </header>

    <div
      v-if="loadError && activeTask"
      class="load-error"
      role="alert"
    >
      <span>同步失败，当前显示已有数据：{{ loadError }}</span>
      <el-button
        text
        type="primary"
        :loading="historyLoading"
        @click="syncTasks"
      >
        重试
      </el-button>
    </div>

    <main
      v-if="activeTask?.detailsLoaded"
      class="discovery-content"
    >
      <section class="progress-card">
        <div class="progress-card-head">
          <div class="progress-card-info">
            <p class="task-subtitle">
              {{ formatCount(activeTask.targetCount) }} 个目标 · {{ portPolicyLabel(activeTask) }} · {{ elapsedText }}
            </p>
            <span
              v-if="isRunning(activeTask)"
              class="throughput"
            >{{ throughputText }}</span>
          </div>
          <div
            v-if="isRunning(activeTask) || isPaused(activeTask)"
            class="progress-actions"
          >
            <el-button
              v-if="isRunning(activeTask)"
              size="small"
              :disabled="controlPending"
              :icon="VideoPause"
              @click="pauseActiveTask"
            >
              暂停
            </el-button>
            <el-button
              v-if="isPaused(activeTask)"
              size="small"
              :disabled="controlPending"
              :icon="VideoPlay"
              @click="resumeActiveTask"
            >
              继续
            </el-button>
            <el-button
              size="small"
              type="danger"
              plain
              :disabled="controlPending"
              :icon="Close"
              @click="stopActiveTask"
            >
              停止
            </el-button>
          </div>
        </div>

        <div class="progress-card-body">
          <div class="stage-track">
            <div
              v-for="(stage, index) in displayStages"
              :key="stage.name"
              class="stage-node"
              :class="stage.classes"
            >
              <div class="stage-node-marker">
                <el-icon v-if="stage.classes.complete">
                  <Check />
                </el-icon><span v-else>{{ index + 1 }}</span>
              </div>
              <div class="stage-node-copy">
                <strong>{{ stage.label }}</strong><span>{{ stage.statusText }}</span>
              </div>
            </div>
          </div>
          <div class="progress-line">
            <span class="progress-line-label">整体进度</span>
            <el-progress
              :percentage="clampProgress(activeTask.progress)"
              :show-text="false"
              :stroke-width="5"
              :status="getProgressStatus(activeTask)"
              :aria-label="`整体进度 · ${currentStageLabel}`"
            />
            <strong>{{ Math.round(clampProgress(activeTask.progress)) }}%</strong>
          </div>
        </div>
      </section>

      <div
        v-if="activeTask.error"
        class="scan-error"
        role="alert"
      >
        <strong>{{ activeTask.status === TaskStatus.FAILED ? '扫描失败' : '扫描已中断' }}</strong>
        <span>{{ activeTask.error }}</span>
      </div>

      <p
        v-if="fingerprintStats?.networkRequestCount != null"
        class="stage-output-empty"
      >
        规则请求 {{ fingerprintStats.logicalRequestCount }} 次 · 合并后 {{ fingerprintStats.networkRequestCount }} 次 · 节省 {{ fingerprintStats.savedRequestCount }} 次
      </p>
      <section
        v-if="hasReachability"
        class="hosts-strip"
      >
        <div class="hosts-heading">
          <strong>已确认可达</strong><b>{{ formatCount(activeTask.reachableHostCount) }}</b>
        </div>
        <div
          v-if="visibleReachableHosts.length"
          class="host-list"
        >
          <span
            v-for="host in visibleReachableHosts"
            :key="host"
            class="host-chip"
          >{{ host }}</span>
          <span
            v-if="reachableHostOverflow > 0"
            class="host-more"
          >+{{ formatCount(reachableHostOverflow) }} 个</span>
        </div>
        <span
          v-else
          class="stage-output-empty"
        >{{ isRunning(activeTask) || isPaused(activeTask) ? '确认可达的主机会在这里显示，未知主机不参与端口扫描' : '尚未确认可达主机' }}</span>
        <p
          v-if="activeTask.unknownHostCount != null"
          class="stage-output-empty"
        >
          未确认 {{ formatCount(activeTask.unknownHostCount) }} 台 · 解析或路径异常 {{ formatCount(activeTask.unreachableHostCount) }} 台 · 待确认 {{ formatCount(activeTask.pendingHostCount) }} 台
        </p>
        <p
          v-if="activeTask.skippedHostCount != null && displayStages.some(stage => stage.name === 'PORT_SCAN')"
          class="stage-output-empty"
        >
          仅扫描已确认可达主机；未知及解析或路径异常主机已跳过 {{ formatCount(activeTask.skippedHostCount) }} 台。
        </p>
      </section>

      <p
        v-else
        class="stage-output-empty"
      >
        {{ displayStages.length === 1 && displayStages[0].name === 'FINGERPRINT' ? '对选定应用执行组件识别。' : '未执行主机探活，直接扫描输入目标。' }}
      </p>

      <AssetResultTable
        v-if="displayStages.some(stage => ['PORT_SCAN', 'FINGERPRINT'].includes(stage.name))"
        :task-id="activeBackendTaskId"
        :session-id="sessionId"
        :refresh-token="resultRefreshToken"
        @fingerprint-scan="supplementalSelection = $event"
      />
    </main>

    <section
      v-else-if="!hasLoaded || (activeTask && !activeTask.detailsLoaded && !loadError)"
      class="page-empty"
      role="status"
      :aria-label="activeTask ? '正在加载任务详情' : '正在加载扫描任务'"
    >
      <el-skeleton
        :rows="3"
        animated
      />
      <p>{{ activeTask ? '正在加载任务详情…' : '正在加载扫描任务…' }}</p>
    </section>
    <section
      v-else-if="loadError"
      class="page-empty"
      role="alert"
    >
      <h2>扫描任务加载失败</h2>
      <p>{{ loadError }}</p>
      <el-button
        :loading="historyLoading"
        :icon="Refresh"
        @click="syncTasks"
      >
        重新加载
      </el-button>
    </section>
    <section
      v-else
      class="page-empty"
    >
      <div class="empty-icon">
        <DataAnalysis />
      </div>
      <h2>开始发现网络资产</h2>
      <p>添加目标，按需执行主机探活、端口扫描、服务识别和组件识别。开始前可预览扫描范围。</p>
      <el-button
        type="primary"
        :icon="Plus"
        @click="showComposer = true"
      >
        新建扫描
      </el-button>
    </section>

    <el-dialog
      :model-value="Boolean(supplementalSelection)"
      title="补扫组件"
      width="min(640px, calc(100vw - 32px))"
      destroy-on-close
      @update:model-value="value => { if (!value) supplementalSelection = null }"
    >
      <FingerprintScanComposer
        v-if="supplementalSelection"
        :session-id="sessionId"
        :selection="supplementalSelection"
        @scan-started="handleScanStarted"
      />
    </el-dialog>
    <el-dialog
      v-model="showComposer"
      title="新建扫描"
      width="min(840px, calc(100vw - 32px))"
      top="4vh"
      class="scan-composer-dialog"
      destroy-on-close
    >
      <ScanComposer
        :session-id="sessionId"
        @scan-started="handleScanStarted"
        @cancel="showComposer = false"
      />
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, toRef, watch } from 'vue'
import {
  Check,
  Close,
  DataAnalysis,
  Plus,
  Refresh,
  VideoPause,
  VideoPlay
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { confirmAction } from '@/utils/confirmUtils.js'
import { clampProgress } from '@/utils/format.js'
import AssetResultTable from './AssetResultTable.vue'
import ScanComposer from './ScanComposer.vue'
import FingerprintScanComposer from './FingerprintScanComposer.vue'
import { selectScanStages, terminalScanStageText } from './scanStages.js'
import { taskEngine } from '../File/TaskEngine.js'
import { TASK_STATUS_TEXT, TERMINAL_TASK_STATUSES, TaskStatus } from '@/constants/task.js'
import { useAssetDiscoveryTasks } from './useAssetDiscoveryTasks.js'

const props = defineProps({ sessionId: { type: String, required: true } })
const showComposer = ref(false)
const supplementalSelection = ref(null)
const controlPending = ref(false)
const {
  tasks,
  selectedTaskId,
  activeTask,
  loading: historyLoading,
  hasLoaded,
  loadError,
  hasMoreHistory,
  loadingMore,
  loadMoreTasks,
  resultRefreshToken,
  selectTask,
  syncTasks,
  refreshTaskList
} = useAssetDiscoveryTasks({
  sessionId: toRef(props, 'sessionId'),
  taskEngine
})
watch(
  () => props.sessionId,
  () => {
    showComposer.value = false
    supplementalSelection.value = null
  }
)
const displayStages = computed(() => {
  const task = activeTask.value
  const snapshots = task?.stages
  return selectScanStages(snapshots?.length ? snapshots.map(stage => stage.name) : undefined)
    .map(stage => {
      const snapshot = snapshots?.find(item => item.name === stage.name)
      const terminalWithoutSnapshot = !snapshot && TERMINAL_TASK_STATUSES.includes(task?.status)
      return {
        ...stage,
        snapshot,
        classes: {
          complete: snapshot ? ['COMPLETED', 'SKIPPED'].includes(snapshot.status) : task?.status === TaskStatus.COMPLETED,
          current: !terminalWithoutSnapshot && (task?.currentStage === stage.name || snapshot?.status === 'RUNNING'),
          failed: snapshot?.status === 'FAILED'
        },
        statusText: stageStatusText(task, stage.name, snapshot)
      }
    })
})

const fingerprintStats = computed(() => displayStages.value.find(stage => stage.name === 'FINGERPRINT')?.snapshot)

const hasReachability = computed(() => displayStages.value.some(stage => stage.name === 'REACHABILITY'))

const activeBackendTaskId = computed(() => {
  return activeTask.value?.backendTaskId || null
})
const currentStageLabel = computed(() => {
  const status = activeTask.value?.status
  if (status === TaskStatus.COMPLETED) return '已完成'
  if (status === TaskStatus.FAILED) return '扫描失败'
  if (status === TaskStatus.CANCELLED) return '已取消'
  return (
    displayStages.value.find((stage) => stage.name === activeTask.value?.currentStage)?.label ||
    '准备扫描'
  )
})
const throughputText = computed(() => {
  const task = activeTask.value
  const startedAt = timestampValue(task?.startTime)
  const processed = task?.probeCompleted ?? 0
  if (task?.status === TaskStatus.COMPLETED) return '扫描已完成'
  if (TERMINAL_TASK_STATUSES.includes(task?.status)) return '扫描已结束'
  if (!startedAt || processed <= 0) return '等待数据'
  const elapsed = Math.max(1, (Date.now() - startedAt) / 1000)
  return `${formatCount(Math.round(processed / elapsed))} 探测/秒`
})
const elapsedText = computed(() => {
  const task = activeTask.value
  const startedAt = timestampValue(task?.startTime || task?.createdAt)
  if (!startedAt) return '-'
  const endedAt = timestampValue(task?.endTime) || Date.now()
  const seconds = Math.max(0, Math.floor((endedAt - startedAt) / 1000))
  if (seconds < 60) return `${seconds} 秒`
  const minutes = Math.floor(seconds / 60)
  return `${minutes} 分 ${seconds % 60} 秒`
})
const visibleReachableHosts = computed(() =>
  Array.isArray(activeTask.value?.reachableHostList)
    ? activeTask.value.reachableHostList.slice(0, 160)
    : []
)
const reachableHostOverflow = computed(() =>
  Math.max(0, (activeTask.value?.reachableHostCount ?? 0) - visibleReachableHosts.value.length)
)
function handleScanStarted(task) {
  if (task?.sessionId && task.sessionId !== props.sessionId) return
  const backendTaskId = task?.taskId
  if (!backendTaskId) {
    ElMessage.error('启动响应缺少任务编号')
    return
  }
  const scan = task.scan || {}
  const targetItems = scan.targets?.items || []
  const stages = selectScanStages(scan.stages)
  const taskId = taskEngine.createScanTask(
    props.sessionId,
    scan.name || '网络资产发现',
    {
      backendTaskId,
      targetCount: targetItems.length,
      scanHosts: targetItems,
      scanPorts: scan.portPolicy?.include || []
    }
  )
  taskEngine.hydrateScanTask(taskId, {
    status: 'RUNNING',
    currentStage: stages[0]?.name,
    stages: stages.map(stage => ({ name: stage.name, status: 'PENDING', progress: 0 }))
  })
  selectedTaskId.value = taskId
  supplementalSelection.value = null
  showComposer.value = false
  refreshTaskList()
  void syncTasks({ discover: false })
  ElMessage.success('扫描已启动')
}
async function controlActiveTask(action, successMessage) {
  const task = activeTask.value
  if (!task || controlPending.value) return
  const sessionId = props.sessionId
  controlPending.value = true
  try {
    if (action === 'stopTask' && !(await confirmAction({
      title: '停止扫描',
      message: '停止后将保留当前已发现结果。',
      confirmButtonText: '停止'
    }))) {
      return
    }
    if (props.sessionId !== sessionId || !taskEngine.getTaskById(task.id)) return
    await taskEngine[action](task.id)
    if (props.sessionId !== sessionId) return
    ElMessage.success(successMessage)
    await taskEngine.queryScanTask(task)
    if (props.sessionId === sessionId) resultRefreshToken.value += 1
  } catch (error) {
    if (props.sessionId === sessionId && error !== 'cancel' && error !== 'close') {
      ElMessage.error(error?.message || '操作失败')
    }
  } finally {
    controlPending.value = false
  }
}
const pauseActiveTask = () => controlActiveTask('pauseTask', '扫描已暂停')
const resumeActiveTask = () => controlActiveTask('resumeTask', '扫描已继续')
const stopActiveTask = () => controlActiveTask('stopTask', '扫描已停止')
function isRunning(task) {
  return task?.status === TaskStatus.SCANNING
}
function isPaused(task) {
  return task?.status === TaskStatus.PAUSED
}
function portPolicyLabel(task) {
  if (task?.stages?.length === 1 && task.stages[0].name === 'REACHABILITY') return '仅主机探活'
  const ports = Array.isArray(task?.scanPorts) ? task.scanPorts.length : 0
  if (ports) return `${formatCount(ports)} 个端口`
  return '预设策略'
}
function getProgressStatus(task) {
  if (!task) return undefined
  if (task.status === TaskStatus.FAILED) return 'exception'
  if (isPaused(task)) return 'warning'
  return undefined
}
function formatCount(value) {
  return Number(value || 0).toLocaleString('zh-CN')
}
function shortTaskId(value) {
  const text = String(value || '')
  return text ? `#${text.slice(0, 8)}` : '未连接任务'
}
function timestampValue(value) {
  const number = Number(value)
  if (value != null && value !== '' && Number.isFinite(number)) return number
  const parsed = Date.parse(String(value || ''))
  return Number.isFinite(parsed) ? parsed : 0
}
function stageStatusText(task, name, stage) {
  const terminalText = terminalScanStageText(task?.status, stage?.status)
  if (terminalText) return terminalText
  if (stage) {
    if (stage.reason === 'NO_REACHABLE_HOSTS') return '未确认可达，已跳过'
    if (stage.reason === 'NO_HTTP_APPLICATIONS') return '无 HTTP 应用，已跳过'
    if (stage.reason === 'DISABLED' || stage.status === 'SKIPPED') return '已跳过'
    if (name === 'REACHABILITY' && task?.reachableHostList)
      return `${formatCount(task.reachableHostCount)} 台已确认可达`
    if (name === 'PORT_SCAN' && task?.openCount)
      return `${formatCount(task.openCount)} 个开放端口`
    if (name === 'FINGERPRINT') {
      return `${formatCount(task.identifiedApplicationCount)} 个应用 · ${formatCount(task.fingerprintCount)} 个组件命中 · ${Number(stage.completed || 0)}/${Number(stage.total || 0)}`
    }
    if (name === 'SERVICE_PROBE' && task?.serviceCount)
      return `${formatCount(task.serviceCount)} 个服务`
    return stage.status === 'RUNNING' ? '扫描中' : TASK_STATUS_TEXT[stage.status.toLowerCase()] || stage.status
  }
  const status = task?.status
  if (status === TaskStatus.COMPLETED) return '已完成'
  if (status === TaskStatus.FAILED) return '未完成'
  if (status === TaskStatus.CANCELLED) return '已取消'
  return '等待中'
}
</script>

<style scoped lang="scss">
.asset-discovery-view {
  container: discovery / inline-size;
  height: 100%;
  min-height: 0;
  padding: 16px 20px 24px;
  overflow: auto;
  box-sizing: border-box;
  color: var(--el-text-color-primary);
  background: var(--el-bg-color-page);
}
.page-head, .task-selector, .head-actions, .progress-actions, .progress-card-head,
.progress-card-info, .progress-card-body, .stage-track, .stage-node, .stage-node-copy,
.progress-line, .hosts-heading, .selector-task-meta, .task-option {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.page-head { justify-content: space-between; padding-bottom: 12px; border-bottom: 1px solid var(--el-border-color-lighter); gap: 16px; }
.task-selector { flex: 1; flex-wrap: wrap; gap: 10px 16px; }
.selector-label { display: grid; gap: 3px; flex-shrink: 0; }
.selector-caption { font-size: 13px; font-weight: 600; }
.selector-count, .selector-task-meta, .task-option-meta, .task-subtitle, .throughput { color: var(--el-text-color-secondary); font-size: 12px; }
.task-select { width: 280px; max-width: 100%; }
.task-option { justify-content: space-between; }
.task-option-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.task-option-meta { flex-shrink: 0; font-size: 11px; }
.head-actions, .progress-actions { flex-shrink: 0; }
.head-actions :deep(.el-button + .el-button), .progress-actions :deep(.el-button + .el-button) { margin-left: 0; }
.status-mark { width: 7px; height: 7px; border-radius: 50%; background: var(--el-text-color-placeholder); }
.status-mark.status-running, .status-mark.status-scanning { background: var(--el-color-primary); }
.status-mark.status-paused { background: var(--el-color-warning); }
.status-mark.status-completed { background: var(--el-color-success); }
.status-mark.status-failed { background: var(--el-color-danger); }
.meta-divider { width: 1px; height: 14px; margin: 0 4px; background: var(--el-border-color); }
.discovery-content { display: grid; gap: 12px; margin-top: 12px; }
.progress-card, .hosts-strip { padding: 12px 14px; border: 1px solid var(--el-border-color-lighter); border-radius: 6px; background: var(--el-bg-color); }
.progress-card-head { justify-content: space-between; flex-wrap: wrap; }
.progress-card-info { flex-wrap: wrap; gap: 6px 12px; }
.task-subtitle { margin: 0; }
.progress-card-body { flex-wrap: wrap; gap: 12px 24px; margin-top: 12px; }
.stage-track { flex: 1; flex-wrap: wrap; gap: 8px 20px; }
.stage-node-marker { display: grid; flex: 0 0 18px; place-items: center; width: 18px; height: 18px; border: 1px solid var(--el-border-color); border-radius: 50%; color: var(--el-text-color-secondary); font-size: 10px; }
.stage-node.current .stage-node-marker { border-color: var(--el-color-primary); color: var(--el-color-white); background: var(--el-color-primary); }
.stage-node.complete .stage-node-marker { border-color: var(--el-color-success); color: var(--el-color-white); background: var(--el-color-success); }
.stage-node.failed .stage-node-marker { border-color: var(--el-color-danger-light-5); color: var(--el-color-danger); background: var(--el-color-danger-light-9); }
.stage-node-copy { align-items: baseline; gap: 6px; }
.stage-node-copy strong { font-size: 12px; }
.stage-node-copy span { color: var(--el-text-color-secondary); font-size: 11px; }
.progress-line { flex: 1 1 180px; max-width: 260px; margin-left: auto; }
.progress-line-label { color: var(--el-text-color-secondary); font-size: 11px; white-space: nowrap; }
.progress-line strong { color: var(--el-color-primary); font-size: 12px; }
.progress-line :deep(.el-progress) { flex: 1; min-width: 0; }
.hosts-heading { justify-content: space-between; font-size: 13px; }
.host-list { display: flex; flex-wrap: wrap; gap: 5px; max-height: 66px; margin-top: 8px; overflow: auto; }
.host-chip, .host-more { padding: 3px 7px; border-radius: 4px; color: var(--el-text-color-regular); background: var(--el-fill-color-light); font-family: monospace; font-size: 11px; }
.stage-output-empty { display: block; margin: 8px 0 0; color: var(--el-text-color-secondary); font-size: 12px; }
.page-empty { display: flex; flex-direction: column; align-items: center; margin: 24px auto 0; padding: 32px 16px; max-width: 520px; text-align: center; }
.empty-icon { display: grid; place-items: center; width: 46px; height: 46px; border-radius: 12px; color: var(--el-color-primary); background: var(--app-brand-background); }
.empty-icon svg { width: 24px; height: 24px; }
.page-empty h2 { margin: 16px 0 0; font-size: 18px; font-weight: 600; }
.page-empty p { margin: 10px 0 20px; color: var(--el-text-color-secondary); font-size: 13px; line-height: 1.7; overflow-wrap: anywhere; }
.load-error { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 12px; padding: 8px 12px; color: var(--el-color-danger); background: var(--el-color-danger-light-9); border-radius: 4px; font-size: 12px; overflow-wrap: anywhere; }
.scan-error { display: grid; gap: 6px; padding: 12px 14px; color: var(--el-color-danger); background: var(--el-color-danger-light-9); border: 1px solid var(--el-color-danger-light-7); border-radius: 6px; font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; }
:deep(.scan-composer-dialog.el-dialog) { padding: 0; overflow: hidden; border-radius: 10px; }
:deep(.scan-composer-dialog .el-dialog__header) { margin: 0; padding: 17px 20px; border-bottom: 1px solid var(--el-border-color-lighter); }
:deep(.scan-composer-dialog .el-dialog__title) { font-size: 16px; font-weight: 600; }
:deep(.scan-composer-dialog .el-dialog__headerbtn) { top: 8px; right: 8px; width: 40px; height: 40px; }
:deep(.scan-composer-dialog .el-dialog__body) { padding: 0; overflow: hidden; }
@container discovery (max-width: 700px) {
  .page-head { flex-wrap: wrap; }
  .has-tasks .task-selector { flex-basis: 100%; }
  .task-select { flex: 1; min-width: 180px; }
  .selector-task-meta { flex-basis: 100%; }
  .progress-line { flex-basis: 100%; max-width: none; }
}
</style>
