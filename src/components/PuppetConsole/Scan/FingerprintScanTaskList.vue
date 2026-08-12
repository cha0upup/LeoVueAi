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
          v-if="selectedTasks.length > 0"
          text
          size="small"
          type="danger"
          @click="handleBatchDelete"
        >
          <el-icon><Icon :icon="iconMap.delete" /></el-icon>
          批量删除 ({{ selectedTasks.length }})
        </el-button>
      </ScanTaskListToolbar>
      <div
        v-if="tasks.length === 0"
        class="empty-tasks"
      >
        <ScanEmptyState
          title="暂无指纹识别任务"
          description="选择指纹并投递目标后，规则命中结果将在这里显示。"
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
          <span class="selected-count">已选 {{ selectedTasks.length }} / {{ tasks.length }}</span>
        </div>
        <FingerprintScanTaskItem
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
import { Icon } from '@iconify/vue'
import { icons } from '@/utils/icons.js'
import FingerprintScanTaskItem from './FingerprintScanTaskItem.vue'
import ScanTaskListToolbar from './ScanTaskListToolbar.vue'
import ScanEmptyState from './ScanEmptyState.vue'

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

const emit = defineEmits(['refresh', 'query', 'remove', 'batch-remove', 'pause', 'resume', 'stop'])

const selectedTasks = ref([])

const isAllSelected = computed(
  () => props.tasks.length > 0 && selectedTasks.value.length === props.tasks.length
)
const isIndeterminate = computed(
  () => selectedTasks.value.length > 0 && selectedTasks.value.length < props.tasks.length
)
const stoppedCount = computed(() => props.tasks.filter((t) => t.status === 'STOPPED').length)
const runningCount = computed(() => props.tasks.filter((t) => t.status !== 'STOPPED').length)

const summaryItems = computed(() => [
  { text: `${props.tasks.length} 个任务` },
  { text: `${stoppedCount.value} 已停止` },
  { text: `${runningCount.value} 活跃中`, active: runningCount.value > 0 }
])

function handleSelectAll(checked) {
  selectedTasks.value = checked ? props.tasks.map((t) => t.taskId) : []
}

function handleTaskSelect(taskId, selected) {
  if (selected) {
    if (!selectedTasks.value.includes(taskId)) selectedTasks.value.push(taskId)
  } else {
    selectedTasks.value = selectedTasks.value.filter((id) => id !== taskId)
  }
}

function handleBatchDelete() {
  if (selectedTasks.value.length === 0) return
  emit('batch-remove', selectedTasks.value.slice())
  selectedTasks.value = []
}
</script>

<style scoped>
.scan-tasks-card {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  background: transparent;
  border: none;
  box-shadow: none;
}

.scan-tasks-card > .card-body {
  flex: 1;
  min-height: 0;
  padding: 0;
}

.task-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 0;
  font-size: 13px;
  padding: 6px 8px;
  background: transparent;
  border-radius: 0;
  border: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-height: 0;
}

.empty-tasks {
  min-height: 0;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  padding: 6px 4px;
  background: var(--app-page-background);
}

.selected-count {
  color: var(--el-text-color-secondary);
}

@media (max-width: 900px) {
  .task-list-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
