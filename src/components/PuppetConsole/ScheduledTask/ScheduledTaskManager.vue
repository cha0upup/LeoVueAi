<template>
  <div class="schtask-workbench">
    <div class="schtask-shell">
      <!-- 工具栏 -->
      <section class="schtask-toolbar">
        <div class="toolbar-left">
          <el-input
            v-model="searchText"
            placeholder="过滤任务名 / 命令"
            size="small"
            clearable
            class="search-input"
            @keyup.enter="handleSearch"
          >
            <template #prefix>
              <el-icon><Icon icon="mdi:magnify" /></el-icon>
            </template>
          </el-input>
          <el-button
            type="primary"
            size="small"
            :loading="isLoading"
            @click="handleListAll"
          >
            <el-icon><Icon icon="mdi:format-list-bulleted" /></el-icon>
            {{ loaded ? '刷新' : '加载全部任务' }}
          </el-button>
        </div>
        <div class="toolbar-right">
          <span
            v-if="filteredTasks.length > 0"
            class="result-count"
          >
            {{ filteredTasks.length }} / {{ tasks.length }} 个任务
          </span>
          <el-button
            size="small"
            text
            @click="showCreateDialog = true"
          >
            <el-icon><Icon icon="mdi:plus" /></el-icon>
            创建
          </el-button>
          <el-button
            size="small"
            text
            :disabled="!filteredTasks.length"
            @click="handleExport"
          >
            <el-icon><Icon icon="mdi:download" /></el-icon>
            导出
          </el-button>
        </div>
      </section>

      <!-- 任务表格 -->
      <section class="schtask-table-wrap">
        <div
          v-if="!loaded && !isLoading"
          class="empty-state"
        >
          <el-icon size="40">
            <Icon icon="mdi:clock-outline" />
          </el-icon>
          <p>点击「加载全部任务」加载远程主机的计划任务列表</p>
        </div>

        <el-table
          v-else
          v-loading="isLoading"
          :data="filteredTasks"
          stripe
          border
          size="small"
          height="100%"
          :default-sort="{ prop: 'taskName', order: 'ascending' }"
          highlight-current-row
          class="schtask-table"
          @sort-change="handleSortChange"
        >
          <el-table-column
            prop="taskName"
            label="任务名"
            min-width="220"
            sortable="custom"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              <span
                class="task-name"
                @click="handleQueryDetail(row.taskName)"
              >
                {{ row.taskName }}
              </span>
            </template>
          </el-table-column>
          <el-table-column
            prop="type"
            label="类型"
            width="110"
            sortable="custom"
          >
            <template #default="{ row }">
              <el-tag
                size="small"
                :type="typeColor(row.type || row.scheduleType)"
                effect="plain"
              >
                {{ row.type || row.scheduleType || '-' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            prop="status"
            label="状态"
            width="90"
            sortable="custom"
          >
            <template #default="{ row }">
              <el-tag
                v-if="row.status"
                size="small"
                :type="statusColor(row.status)"
                effect="plain"
              >
                {{ row.status }}
              </el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column
            prop="schedule"
            label="计划"
            width="180"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              {{ row.schedule || row.cronExpression || row.nextRun || '-' }}
            </template>
          </el-table-column>
          <el-table-column
            prop="command"
            label="命令"
            min-width="250"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              <span class="cmd-text">{{ row.command || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column
            prop="source"
            label="来源"
            width="120"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              {{ row.source || row.author || '-' }}
            </template>
          </el-table-column>
          <el-table-column
            label="操作"
            width="100"
            fixed="right"
          >
            <template #default="{ row }">
              <el-popconfirm
                :title="`确认删除任务 '${row.taskName}'？`"
                confirm-button-text="删除"
                cancel-button-text="取消"
                @confirm="handleDelete(row.taskName)"
              >
                <template #reference>
                  <el-button
                    type="danger"
                    size="small"
                    text
                  >
                    删除
                  </el-button>
                </template>
              </el-popconfirm>
            </template>
          </el-table-column>
        </el-table>
      </section>
    </div>

    <!-- 创建任务对话框 -->
    <el-dialog
      v-model="showCreateDialog"
      title="创建计划任务"
      width="520px"
      destroy-on-close
    >
      <el-form
        label-width="90px"
        size="small"
      >
        <el-form-item label="平台">
          <el-radio-group v-model="createForm.platform">
            <el-radio value="windows">
              Windows
            </el-radio>
            <el-radio value="linux">
              Linux
            </el-radio>
          </el-radio-group>
        </el-form-item>

        <!-- Windows 字段 -->
        <template v-if="createForm.platform === 'windows'">
          <el-form-item label="任务名">
            <el-input
              v-model="createForm.taskName"
              placeholder="\\MyTasks\\Backup"
            />
          </el-form-item>
          <el-form-item label="命令">
            <el-input
              v-model="createForm.command"
              placeholder="cmd.exe /c echo hello"
            />
          </el-form-item>
          <el-form-item label="计划类型">
            <el-select v-model="createForm.schedule">
              <el-option
                label="MINUTE"
                value="MINUTE"
              />
              <el-option
                label="HOURLY"
                value="HOURLY"
              />
              <el-option
                label="DAILY"
                value="DAILY"
              />
              <el-option
                label="WEEKLY"
                value="WEEKLY"
              />
              <el-option
                label="MONTHLY"
                value="MONTHLY"
              />
              <el-option
                label="ONCE"
                value="ONCE"
              />
              <el-option
                label="ONSTART"
                value="ONSTART"
              />
              <el-option
                label="ONLOGON"
                value="ONLOGON"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="频率修饰">
            <el-input
              v-model="createForm.modifier"
              placeholder="如 5 (每5个单位)，可留空"
            />
          </el-form-item>
          <el-form-item label="开始时间">
            <el-input
              v-model="createForm.startTime"
              placeholder="HH:mm，可留空"
            />
          </el-form-item>
          <el-form-item label="运行身份">
            <el-input
              v-model="createForm.runAs"
              placeholder="SYSTEM，可留空"
            />
          </el-form-item>
        </template>

        <!-- Linux 字段 -->
        <template v-else>
          <el-form-item label="Cron 表达式">
            <el-input
              v-model="createForm.cronExpression"
              placeholder="*/5 * * * * (每5分钟)"
            />
          </el-form-item>
          <el-form-item label="命令">
            <el-input
              v-model="createForm.command"
              placeholder="/usr/bin/backup.sh"
            />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button
          size="small"
          @click="showCreateDialog = false"
        >
          取消
        </el-button>
        <el-button
          type="primary"
          size="small"
          :loading="isLoading"
          @click="handleCreate"
        >
          创建
        </el-button>
      </template>
    </el-dialog>

    <!-- 任务详情对话框 -->
    <el-dialog
      v-model="showDetailDialog"
      title="任务详情"
      width="600px"
      destroy-on-close
    >
      <div
        v-if="taskDetail"
        class="detail-content"
      >
        <div
          v-if="taskDetail.detail"
          class="detail-grid"
        >
          <div
            v-for="(val, key) in taskDetail.detail"
            :key="key"
            class="detail-row"
          >
            <span class="detail-key">{{ key }}</span>
            <span class="detail-val">{{ val }}</span>
          </div>
        </div>
        <div v-else-if="taskDetail.tasks && taskDetail.tasks.length > 0">
          <div
            v-for="(t, idx) in taskDetail.tasks"
            :key="idx"
            class="detail-task-item"
          >
            <div><strong>{{ t.taskName }}</strong></div>
            <div
              v-if="t.cronExpression"
              class="detail-sub"
            >
              cron: {{ t.cronExpression }} ({{ t.schedule }})
            </div>
            <div
              v-if="t.command"
              class="detail-sub cmd-text"
            >
              {{ t.command }}
            </div>
            <div
              v-if="t.source"
              class="detail-sub"
            >
              来源: {{ t.source }}
            </div>
          </div>
        </div>
        <div
          v-if="taskDetail.rawOutput"
          class="raw-output"
        >
          <el-collapse>
            <el-collapse-item title="原始输出">
              <pre class="raw-pre">{{ taskDetail.rawOutput }}</pre>
            </el-collapse-item>
          </el-collapse>
        </div>
      </div>
      <div
        v-else
        v-loading="true"
        class="loading-placeholder"
      />
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import { Icon } from '@iconify/vue'
import {
  listScheduledTasksApi,
  queryScheduledTaskApi,
  createScheduledTaskApi,
  deleteScheduledTaskApi
} from '@/services/api.js'
import { showError, showSuccess, showWarning } from '@/utils/messageUtils.js'

const props = defineProps({
  sessionId: {
    type: String,
    required: true
  }
})

// ==================== 状态 ====================

const isLoading = ref(false)
const loaded = ref(false)
const tasks = ref([])
const searchText = ref('')
const sortState = ref({ prop: 'taskName', order: 'ascending' })
const showCreateDialog = ref(false)
const showDetailDialog = ref(false)
const taskDetail = ref(null)

const createForm = reactive({
  platform: 'windows',
  taskName: '',
  command: '',
  schedule: 'DAILY',
  modifier: '',
  startTime: '',
  runAs: '',
  cronExpression: ''
})

// ==================== 计算属性 ====================

const filteredTasks = computed(() => {
  let list = [...tasks.value]
  const q = searchText.value.trim().toLowerCase()
  if (q) {
    list = list.filter(t => {
      const name = (t.taskName || '').toLowerCase()
      const cmd = (t.command || '').toLowerCase()
      return name.includes(q) || cmd.includes(q)
    })
  }

  const { prop, order } = sortState.value
  if (prop && order) {
    list.sort((a, b) => {
      const va = (a[prop] || '').toString()
      const vb = (b[prop] || '').toString()
      const cmp = va.localeCompare(vb)
      return order === 'ascending' ? cmp : -cmp
    })
  }
  return list
})

// ==================== 方法 ====================

async function handleListAll() {
  isLoading.value = true
  loaded.value = true
  try {
    const res = await listScheduledTasksApi({ sessionId: props.sessionId })
    const data = res.data
    tasks.value = data.tasks || []
    if (tasks.value.length === 0) {
      showWarning('未获取到计划任务')
    }
  } catch (err) {
    showError('获取计划任务失败: ' + (err.message || err))
  } finally {
    isLoading.value = false
  }
}

function handleSearch() {
  // 前端过滤，不需要额外请求
  if (!loaded.value) {
    handleListAll()
  }
}

async function handleQueryDetail(taskName) {
  showDetailDialog.value = true
  taskDetail.value = null
  try {
    const res = await queryScheduledTaskApi({ sessionId: props.sessionId, taskName })
    taskDetail.value = res.data
  } catch (err) {
    showError('查询任务详情失败: ' + (err.message || err))
    showDetailDialog.value = false
  }
}

async function handleCreate() {
  if (!createForm.command.trim()) {
    showWarning('请输入要执行的命令')
    return
  }

  isLoading.value = true
  try {
    const params = { sessionId: props.sessionId, command: createForm.command }
    if (createForm.platform === 'linux') {
      if (!createForm.cronExpression.trim()) {
        showWarning('请输入 Cron 表达式')
        isLoading.value = false
        return
      }
      params.cronExpression = createForm.cronExpression
    } else {
      if (!createForm.taskName.trim()) {
        showWarning('请输入任务名称')
        isLoading.value = false
        return
      }
      params.taskName = createForm.taskName
      params.schedule = createForm.schedule
      if (createForm.modifier) params.modifier = createForm.modifier
      if (createForm.startTime) params.startTime = createForm.startTime
      if (createForm.runAs) params.runAs = createForm.runAs
      params.force = true
    }

    await createScheduledTaskApi(params)
    showSuccess('计划任务已创建')
    showCreateDialog.value = false
    if (loaded.value) await handleListAll()
  } catch (err) {
    showError('创建计划任务失败: ' + (err.message || err))
  } finally {
    isLoading.value = false
  }
}

async function handleDelete(taskName) {
  try {
    await deleteScheduledTaskApi({ sessionId: props.sessionId, taskName })
    showSuccess(`任务 '${taskName}' 已删除`)
    tasks.value = tasks.value.filter(t => t.taskName !== taskName)
  } catch (err) {
    showError('删除计划任务失败: ' + (err.message || err))
  }
}

function handleSortChange({ prop, order }) {
  sortState.value = { prop, order }
}

function handleExport() {
  if (filteredTasks.value.length === 0) return
  const header = 'TaskName\tType\tStatus\tSchedule\tCommand\tSource\n'
  const rows = filteredTasks.value.map(t =>
    [
      t.taskName || '',
      t.type || t.scheduleType || '',
      t.status || '',
      t.schedule || t.cronExpression || t.nextRun || '',
      t.command || '',
      t.source || t.author || ''
    ].join('\t')
  ).join('\n')
  const blob = new Blob([header + rows], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'scheduled-tasks.tsv'
  a.click()
  URL.revokeObjectURL(url)
}

function typeColor(type) {
  if (!type) return 'info'
  const t = type.toLowerCase()
  if (t.includes('cron')) return ''
  if (t.includes('systemd')) return 'success'
  if (t.includes('at')) return 'warning'
  if (t.includes('daily') || t.includes('weekly')) return ''
  return 'info'
}

function statusColor(status) {
  if (!status) return 'info'
  const s = status.toLowerCase()
  if (s.includes('ready') || s.includes('就绪') || s.includes('running') || s.includes('运行')) return 'success'
  if (s.includes('disabled') || s.includes('已禁用')) return 'danger'
  return 'info'
}
</script>

<style scoped>
.schtask-workbench {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
}

.schtask-shell {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.schtask-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  gap: 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color-page);
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-input {
  width: 260px;
}

.result-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.schtask-table-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.schtask-table {
  font-size: 12px;
}

.task-name {
  color: var(--el-color-primary);
  cursor: pointer;
}

.task-name:hover {
  text-decoration: underline;
}

.cmd-text {
  font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;
  font-size: 11px;
  color: var(--el-text-color-regular);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--el-text-color-placeholder);
  gap: 12px;
  padding: 40px;
}

.empty-state p {
  font-size: 13px;
}

/* ── 详情 ── */
.detail-content {
  max-height: 500px;
  overflow: auto;
}

.detail-grid {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-row {
  display: flex;
  font-size: 12px;
  line-height: 1.6;
}

.detail-key {
  flex-shrink: 0;
  width: 180px;
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

.detail-val {
  word-break: break-all;
  color: var(--el-text-color-regular);
}

.detail-task-item {
  padding: 8px;
  margin-bottom: 6px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  font-size: 12px;
}

.detail-sub {
  margin-top: 2px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.raw-output {
  margin-top: 12px;
}

.raw-pre {
  font-size: 11px;
  font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 300px;
  overflow: auto;
}

.loading-placeholder {
  height: 200px;
}
</style>
