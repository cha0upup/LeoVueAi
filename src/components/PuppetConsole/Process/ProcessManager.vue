<template>
  <div class="process-workbench">
    <div class="process-shell">
      <!-- 工具栏 -->
      <section class="process-toolbar">
        <div class="toolbar-left">
          <el-input
            v-model="searchText"
            placeholder="搜索进程名 / 命令行 / PID"
            size="small"
            clearable
            class="search-input"
            @keyup.enter="handleSearch"
          >
            <template #prefix>
              <el-icon><Icon icon="mdi:magnify" /></el-icon>
            </template>
          </el-input>
          <el-input
            v-model="portFilter"
            placeholder="监听端口"
            size="small"
            clearable
            class="port-input"
            @keyup.enter="handleSearch"
          />
          <el-button
            type="primary"
            size="small"
            :loading="isLoading"
            @click="handleSearch"
          >
            <el-icon><Icon icon="mdi:magnify" /></el-icon>
            查找
          </el-button>
          <el-button
            size="small"
            :loading="isLoading"
            @click="handleListAll"
          >
            <el-icon><Icon icon="mdi:format-list-bulleted" /></el-icon>
            全部进程
          </el-button>
        </div>
        <div class="toolbar-right">
          <span
            v-if="processes.length > 0"
            class="result-count"
          >
            共 {{ processes.length }} 个进程
          </span>
          <el-button
            size="small"
            text
            :disabled="!processes.length"
            @click="handleExport"
          >
            <el-icon><Icon icon="mdi:download" /></el-icon>
            导出
          </el-button>
        </div>
      </section>

      <!-- 进程表格 -->
      <section class="process-table-wrap">
        <div
          v-if="!loaded && !isLoading"
          class="empty-state"
        >
          <el-icon size="40">
            <Icon icon="mdi:application-cog-outline" />
          </el-icon>
          <p>输入关键字查找进程，或点击「全部进程」加载完整列表</p>
        </div>

        <el-table
          v-else
          v-loading="isLoading"
          :data="sortedProcesses"
          stripe
          border
          size="small"
          height="100%"
          :default-sort="{ prop: 'pid', order: 'ascending' }"
          highlight-current-row
          class="process-table"
          @sort-change="handleSortChange"
        >
          <el-table-column
            prop="pid"
            label="PID"
            width="80"
            sortable="custom"
          />
          <el-table-column
            prop="ppid"
            label="PPID"
            width="80"
            sortable="custom"
          >
            <template #default="{ row }">
              {{ row.ppid ?? '-' }}
            </template>
          </el-table-column>
          <el-table-column
            prop="name"
            label="进程名"
            width="160"
            sortable="custom"
            show-overflow-tooltip
          />
          <el-table-column
            prop="user"
            label="用户"
            width="100"
            sortable="custom"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              {{ row.user ?? '-' }}
            </template>
          </el-table-column>
          <el-table-column
            prop="memKb"
            label="内存"
            width="100"
            sortable="custom"
          >
            <template #default="{ row }">
              {{ row.memKb != null ? formatMem(row.memKb) : '-' }}
            </template>
          </el-table-column>
          <el-table-column
            prop="cmd"
            label="命令行"
            min-width="300"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              <span class="cmd-text">{{ row.cmd || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="hasMatchedPort"
            prop="matchedPort"
            label="匹配端口"
            width="90"
          />
          <el-table-column
            label="操作"
            width="80"
            fixed="right"
          >
            <template #default="{ row }">
              <el-popconfirm
                :title="`确认终止进程 ${row.pid} (${row.name})？`"
                confirm-button-text="终止"
                cancel-button-text="取消"
                @confirm="handleKill(row.pid, false)"
              >
                <template #reference>
                  <el-button
                    type="danger"
                    size="small"
                    text
                    :loading="killingPid === row.pid"
                  >
                    Kill
                  </el-button>
                </template>
              </el-popconfirm>
            </template>
          </el-table-column>
        </el-table>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { listProcessesApi, findProcessesApi, killProcessApi } from '@/services/api.js'
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
const processes = ref([])
const searchText = ref('')
const portFilter = ref('')
const killingPid = ref(null)

const sortState = ref({ prop: 'pid', order: 'ascending' })

// ==================== 计算属性 ====================

const hasMatchedPort = computed(() => {
  return processes.value.some(p => p.matchedPort != null)
})

const sortedProcesses = computed(() => {
  const list = [...processes.value]
  const { prop, order } = sortState.value
  if (!prop || !order) return list

  list.sort((a, b) => {
    let va = a[prop]
    let vb = b[prop]
    if (va == null) va = prop === 'pid' || prop === 'ppid' || prop === 'memKb' ? -1 : ''
    if (vb == null) vb = prop === 'pid' || prop === 'ppid' || prop === 'memKb' ? -1 : ''
    if (typeof va === 'number' && typeof vb === 'number') {
      return order === 'ascending' ? va - vb : vb - va
    }
    const cmp = String(va).localeCompare(String(vb))
    return order === 'ascending' ? cmp : -cmp
  })
  return list
})

// ==================== 方法 ====================

async function handleListAll() {
  isLoading.value = true
  loaded.value = true
  try {
    const res = await listProcessesApi({ sessionId: props.sessionId })
    const data = res.data
    processes.value = data.processes || []
  } catch (err) {
    showError('获取进程列表失败: ' + (err.message || err))
  } finally {
    isLoading.value = false
  }
}

async function handleSearch() {
  const name = searchText.value.trim()
  const port = portFilter.value.trim()

  if (!name && !port) {
    showWarning('请输入搜索关键字或端口号')
    return
  }

  // 如果搜索文本是纯数字且未填端口，同时按 PID 和名称搜
  let pidVal = -1
  if (name && /^\d+$/.test(name) && !port) {
    pidVal = parseInt(name, 10)
  }

  isLoading.value = true
  loaded.value = true
  try {
    const params = { sessionId: props.sessionId }
    if (name) params.name = name
    if (pidVal > 0) params.pid = pidVal
    if (port) params.port = parseInt(port, 10) || -1

    const res = await findProcessesApi(params)
    const data = res.data
    processes.value = data.processes || []

    if (processes.value.length === 0) {
      showWarning('未找到匹配的进程')
    }
  } catch (err) {
    showError('查找进程失败: ' + (err.message || err))
  } finally {
    isLoading.value = false
  }
}

async function handleKill(pid, force) {
  killingPid.value = pid
  try {
    await killProcessApi({ sessionId: props.sessionId, pid, force })
    showSuccess(`进程 ${pid} 已终止`)
    // 从列表中移除
    processes.value = processes.value.filter(p => p.pid !== pid)
  } catch (err) {
    showError('终止进程失败: ' + (err.message || err))
  } finally {
    killingPid.value = null
  }
}

function handleSortChange({ prop, order }) {
  sortState.value = { prop, order }
}

function formatMem(kb) {
  if (kb == null) return '-'
  if (kb < 1024) return kb + ' KB'
  if (kb < 1024 * 1024) return (kb / 1024).toFixed(1) + ' MB'
  return (kb / 1024 / 1024).toFixed(2) + ' GB'
}

function handleExport() {
  if (processes.value.length === 0) return
  const header = 'PID\tPPID\tName\tUser\tMemKB\tCommand\n'
  const rows = processes.value.map(p =>
    [p.pid, p.ppid ?? '', p.name || '', p.user || '', p.memKb ?? '', p.cmd || ''].join('\t')
  ).join('\n')
  const blob = new Blob([header + rows], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'processes.tsv'
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.process-workbench {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
}

.process-shell {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* ── 工具栏 ── */
.process-toolbar {
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
  width: 240px;
}

.port-input {
  width: 110px;
}

.result-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

/* ── 表格区域 ── */
.process-table-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.process-table {
  font-size: 12px;
}

.cmd-text {
  font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;
  font-size: 11px;
  color: var(--el-text-color-regular);
}

/* ── 空状态 ── */
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
</style>
