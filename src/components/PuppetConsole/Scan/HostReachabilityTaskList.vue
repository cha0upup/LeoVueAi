<template>
  <section class="host-reachability-tasks-card card">
    <div class="card-body">
      <ScanTaskListToolbar
        v-if="tasks.length > 0"
        :summary-items="summaryItems"
        :show-refresh="false"
      >
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
          title="暂无探活任务"
          description="输入目标并启动探活后，可达性结果将在这里持续更新。"
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
        <HostReachabilityTaskItem
          v-for="task in tasks"
          :key="task.taskId"
          :task="task"
          :selected="selectedTasks.includes(task.taskId)"
          @select="handleTaskSelect"
          @remove="$emit('remove', $event)"
          @batch-scan="$emit('batch-scan', $event)"
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
import HostReachabilityTaskItem from './HostReachabilityTaskItem.vue'
import ScanEmptyState from './ScanEmptyState.vue'
import ScanTaskListToolbar from './ScanTaskListToolbar.vue'
import { showSuccess, showWarning } from '@/utils/messageUtils.js'

const iconMap = icons

const props = defineProps({
  tasks: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['remove', 'batch-remove', 'batch-scan'])

const selectedTasks = ref([])

const isAllSelected = computed(() => {
  return props.tasks.length > 0 && selectedTasks.value.length === props.tasks.length
})

const isIndeterminate = computed(() => {
  return selectedTasks.value.length > 0 && selectedTasks.value.length < props.tasks.length
})

const hasCompletedTasks = computed(() => {
  return props.tasks.some((task) => task.status && task.result)
})

const completedCount = computed(() => {
  return props.tasks.filter((task) => task.status && task.result).length
})

const runningCount = computed(() => {
  return props.tasks.filter((task) => !task.status).length
})

const reachableHostCount = computed(() => {
  return props.tasks.reduce((sum, task) => sum + (task.result?.reachableCount || 0), 0)
})

const summaryItems = computed(() => [
  { text: `${props.tasks.length} 个任务` },
  { text: `${completedCount.value} 已完成` },
  { text: `${runningCount.value} 进行中`, active: runningCount.value > 0 },
  { text: `${reachableHostCount.value} 可达` }
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

// 导出所有已完成的任务
const handleExportAll = () => {
  const completedTasks = props.tasks.filter((task) => task.status && task.result)

  if (completedTasks.length === 0) {
    showWarning('没有可导出的已完成任务')
    return
  }

  const headers = [
    '任务ID',
    '主机列表',
    '总主机数',
    '可达主机数',
    '不可达主机数',
    '可达主机',
    '不可达主机',
    '创建时间'
  ]
  const rows = completedTasks.map((task) => {
    const reachableHosts = task.result?.reachableHostList?.join(',') || ''
    const unreachableHosts = task.result?.unreachableHostList?.join(',') || ''
    const createTime = task.createTime ? new Date(task.createTime).toLocaleString('zh-CN') : ''
    const hostList = task.scanHosts?.join(',') || ''

    return [
      task.taskId || '',
      hostList,
      task.result?.totalCount || 0,
      task.result?.reachableCount || 0,
      task.result?.unreachableCount || 0,
      reachableHosts,
      unreachableHosts,
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

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
  const filename = `主机探活结果_${timestamp}.csv`

  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  showSuccess(`已导出 ${completedTasks.length} 个任务的探活结果`)
}
</script>

<style scoped>
.host-reachability-tasks-card {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  margin-bottom: 0;
  background: transparent;
  border: none;
  box-shadow: none;
}

.host-reachability-tasks-card > .card-body {
  flex: 1;
  min-height: 0;
  padding: 0;
}

.empty-tasks {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 28px 18px;
  min-height: 168px;
  background: var(--app-page-background);
}

.empty-tasks :deep(.scan-empty-state) {
  max-width: 520px;
  background: var(--app-card-background);
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
  padding: 7px 9px;
  background: var(--app-control-background-soft);
  border-radius: var(--radius-control);
  border: 1px solid color-mix(in srgb, var(--el-border-color) 16%, transparent);
  margin-bottom: 2px;
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
