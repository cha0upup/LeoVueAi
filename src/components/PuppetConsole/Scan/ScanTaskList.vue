<template>
  <section class="scan-tasks-card card">
    <div class="card-body">
      <ScanTaskListToolbar
        v-if="tasks.length > 0"
        :summary-items="summaryItems"
        :is-refreshing="isRefreshing"
        @refresh="$emit('refresh')"
      >
        <el-button
          v-if="selectedTasks.length > 0 && selectedTcpTargetsCount > 0"
          text
          size="small"
          type="primary"
          @click="handleBatchTcpFingerprint"
        >
          <el-icon><Icon :icon="iconMap.fingerprint" /></el-icon>
          批量TCP指纹识别 ({{ selectedTcpTargetsCount }})
        </el-button>
        <el-button
          v-if="selectedTasks.length > 0"
          text
          size="small"
          type="danger"
          @click="handleBatchDelete"
        >
          <el-icon><Icon :icon="iconMap.delete" /></el-icon>
          批量删除 ({{ selectedTasks.length }})
        </el-button>
        <el-button
          text
          size="small"
          :disabled="!hasCompletedTasks"
          @click="handleExportAll"
        >
          <el-icon><Icon :icon="iconMap.download" /></el-icon>
          导出全部
        </el-button>
      </ScanTaskListToolbar>
      <div
        v-if="tasks.length === 0"
        class="empty-tasks"
      >
        <ScanEmptyState
          title="暂无端口扫描任务"
          description="配置目标和端口后，扫描进度与开放端口将在这里显示。"
        />
      </div>

      <div
        v-else
        class="task-list"
      >
        <div
          v-if="tasks.length > 0"
          class="task-list-header"
        >
          <el-checkbox
            :model-value="isAllSelected"
            :indeterminate="isIndeterminate"
            @change="handleSelectAll"
          >
            全选
          </el-checkbox>
          <span class="selected-count">已选择 {{ selectedTasks.length }} / {{ tasks.length }}</span>
        </div>
        <ScanTaskItem
          v-for="task in tasks"
          :key="task.taskId"
          :task="task"
          :selected="selectedTasks.includes(task.taskId)"
          @select="handleTaskSelect"
          @query="$emit('query', $event)"
          @remove="$emit('remove', $event)"
          @pause="$emit('pause', $event)"
          @resume="$emit('resume', $event)"
          @stop="$emit('stop', $event)"
        />
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed } from 'vue'
import { confirmDelete } from '@/utils/confirmUtils.js'
import { Icon } from '@iconify/vue'
import { icons } from '@/utils/icons.js'
import ScanTaskItem from './ScanTaskItem.vue'
import ScanTaskListToolbar from './ScanTaskListToolbar.vue'
import ScanEmptyState from './ScanEmptyState.vue'
import { showSuccess, showWarning } from '@/utils/messageUtils.js'

const iconMap = icons

const props = defineProps({
  tasks: {
    type: Array,
    default: () => []
  },
  isRefreshing: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'refresh',
  'query',
  'remove',
  'batch-remove',
  'pause',
  'resume',
  'stop',
  'batch-tcp-fingerprint'
])

const selectedTasks = ref([])

const isAllSelected = computed(() => {
  return props.tasks.length > 0 && selectedTasks.value.length === props.tasks.length
})

const isIndeterminate = computed(() => {
  return selectedTasks.value.length > 0 && selectedTasks.value.length < props.tasks.length
})

const completedCount = computed(() => {
  return props.tasks.filter(
    (task) => task.status === 'STOPPED' && task.scannedCount === task.portLength
  ).length
})

const runningCount = computed(() => {
  return props.tasks.filter((task) => task.status !== 'STOPPED').length
})

const summaryItems = computed(() => [
  { text: `${props.tasks.length} 个任务` },
  { text: `${completedCount.value} 已完成` },
  { text: `${runningCount.value} 活跃中`, active: runningCount.value > 0 }
])

const handleSelectAll = (checked) => {
  if (checked) {
    selectedTasks.value = props.tasks.map((task) => task.taskId)
  } else {
    selectedTasks.value = []
  }
}

const handleTaskSelect = (taskId, selected) => {
  if (selected) {
    if (!selectedTasks.value.includes(taskId)) {
      selectedTasks.value.push(taskId)
    }
  } else {
    const index = selectedTasks.value.indexOf(taskId)
    if (index > -1) {
      selectedTasks.value.splice(index, 1)
    }
  }
}

const handleBatchDelete = async () => {
  if (selectedTasks.value.length === 0) {
    showWarning('请至少选择一个任务')
    return
  }

  const count = selectedTasks.value.length
  const confirmed = await confirmDelete({
    title: '确认批量删除',
    message: `确定要删除选中的 ${count} 个任务吗？`
  })
  if (!confirmed) return

  emit('batch-remove', [...selectedTasks.value])
  selectedTasks.value = []
  showSuccess(`已删除 ${count} 个任务`)
}

const hasCompletedTasks = computed(() => {
  return props.tasks.some(
    (task) =>
      task.status === 'STOPPED' &&
      task.scannedCount === task.portLength &&
      task.openPortList?.length > 0
  )
})

// 从选中的任务中收集所有开放端口为 TCP 目标 { host, port }
const selectedTcpTargets = computed(() => {
  return props.tasks
    .filter((task) => selectedTasks.value.includes(task.taskId) && task.openPortList?.length > 0)
    .flatMap((task) =>
      (task.openPortList || []).map((port) => ({ host: task.scanHost, port: Number(port) }))
    )
})

const selectedTcpTargetsCount = computed(() => selectedTcpTargets.value.length)

const handleBatchTcpFingerprint = () => {
  if (selectedTcpTargets.value.length === 0) return
  emit('batch-tcp-fingerprint', [...selectedTcpTargets.value])
}

// 获取任务状态文本
const getTaskStatusText = (task) => {
  if (task.status === 'STOPPED' && task.scannedCount === task.portLength) {
    return '已完成'
  }
  if (task.status === 'STOPPED') {
    return '已终止'
  }
  if (task.status === 'PAUSED') {
    return '已暂停'
  }
  return '运行中'
}

// 导出扫描结果为CSV
const exportToCSV = (tasks, filename) => {
  const headers = [
    '主机地址',
    '任务ID',
    '状态',
    '扫描状态',
    '总端口数',
    '已扫描',
    '开放端口数',
    '开放端口',
    '创建时间'
  ]
  const rows = tasks.map((task) => {
    const openPorts = task.openPortList?.join(',') || ''
    const createTime = task.createTime ? new Date(task.createTime).toLocaleString('zh-CN') : ''

    return [
      task.scanHost || '',
      task.taskId || '',
      task.status === 'STOPPED' && task.scannedCount === task.portLength ? '已完成' : '进行中',
      getTaskStatusText(task),
      task.portLength || 0,
      task.scannedCount || 0,
      task.openPortList?.length || 0,
      openPorts,
      createTime
    ]
  })

  // 创建CSV内容
  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n')

  // 添加BOM以支持中文
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// 导出所有已完成的任务
const handleExportAll = () => {
  const completedTasks = props.tasks.filter(
    (task) =>
      task.status === 'STOPPED' &&
      task.scannedCount === task.portLength &&
      task.openPortList?.length > 0
  )

  if (completedTasks.length === 0) {
    showWarning('没有可导出的已完成任务')
    return
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
  const filename = `端口扫描结果_${timestamp}.csv`
  exportToCSV(completedTasks, filename)
  showSuccess(`已导出 ${completedTasks.length} 个任务的扫描结果`)
}
</script>

<style scoped>
.scan-tasks-card {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  margin-bottom: 0;
  background: transparent;
  border: none;
  box-shadow: none;
}

.scan-tasks-card > .card-body {
  flex: 1;
  min-height: 0;
  padding: 0;
}

.empty-tasks {
  display: flex;
  justify-content: flex-start;
  align-items: flex-start;
  padding: 6px 4px;
  min-height: 0;
  background: var(--app-page-background);
}


.task-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-height: 0;
}

.task-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  background: transparent;
  border-radius: 0;
  border: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  margin-bottom: 0;
}

:global(html.dark .task-header-summary),
:global(html[data-theme='dark'] .task-header-summary) {
  background: var(--app-control-background-soft);
}

:global(html.dark .task-list-header),
:global(html[data-theme='dark'] .task-list-header) {
  background: var(--app-control-background-soft);
  border-color: color-mix(in srgb, var(--el-border-color) 18%, transparent);
}

.selected-count {
  font-size: var(--el-font-size-small);
  color: var(--el-text-color-secondary);
}

@media (max-width: 900px) {
  .task-list-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>
