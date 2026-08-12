<template>
  <div class="persist-workbench">
    <div class="persist-shell">
      <!-- 工具栏 -->
      <section class="persist-toolbar">
        <div class="toolbar-left">
          <el-input
            v-model="searchText"
            placeholder="过滤名称 / 命令 / 路径"
            size="small"
            clearable
            class="search-input"
          >
            <template #prefix>
              <el-icon><Icon icon="mdi:magnify" /></el-icon>
            </template>
          </el-input>
          <el-button
            type="primary"
            size="small"
            :loading="isLoading"
            @click="handleList"
          >
            <el-icon><Icon icon="mdi:shield-search" /></el-icon>
            {{ loaded ? '刷新' : '扫描持久化项' }}
          </el-button>
        </div>
        <div class="toolbar-right">
          <span
            v-if="filteredEntries.length > 0"
            class="result-count"
          >
            {{ filteredEntries.length }} / {{ entries.length }} 个条目
            <template v-if="suspiciousCount > 0">
              ，<span class="suspicious-count">{{ suspiciousCount }} 可疑</span>
            </template>
          </span>
          <el-checkbox
            v-model="onlySuspicious"
            size="small"
          >
            仅可疑
          </el-checkbox>
          <el-checkbox
            v-if="hasMacOS"
            v-model="hideApple"
            size="small"
          >
            隐藏 Apple 项
          </el-checkbox>
          <el-button
            size="small"
            text
            :disabled="!filteredEntries.length"
            @click="handleExport"
          >
            <el-icon><Icon icon="mdi:download" /></el-icon>
            导出
          </el-button>
        </div>
      </section>

      <!-- 主内容 -->
      <section class="persist-table-wrap">
        <div
          v-if="!loaded && !isLoading"
          class="empty-state"
        >
          <el-icon size="40">
            <Icon icon="mdi:shield-lock-outline" />
          </el-icon>
          <p>点击「扫描持久化项」枚举远程主机的自启动 / 持久化机制</p>
          <p class="hint-text">
            Windows: 注册表 Run/RunOnce、Startup、IFEO、WMI、Auto-Start 服务
          </p>
          <p class="hint-text">
            macOS: LaunchDaemons/Agents、Login Items、Cron
          </p>
          <p class="hint-text">
            Linux: systemd enabled、Cron、rc.local、XDG autostart、init.d
          </p>
        </div>

        <el-table
          v-else
          v-loading="isLoading"
          :data="filteredEntries"
          stripe
          border
          size="small"
          height="100%"
          :default-sort="{ prop: 'type', order: 'ascending' }"
          highlight-current-row
          class="persist-table"
        >
          <el-table-column
            prop="name"
            label="名称"
            min-width="200"
            sortable
            show-overflow-tooltip
          >
            <template #default="{ row }">
              <span
                class="entry-name"
                @click="handleQuery(row)"
              >{{ row.name || '-' }}</span>
              <el-icon
                v-if="row.suspicious"
                class="suspicious-icon"
                title="可疑"
              >
                <Icon icon="mdi:alert-circle" />
              </el-icon>
            </template>
          </el-table-column>
          <el-table-column
            prop="type"
            label="类型"
            width="140"
            sortable
          >
            <template #default="{ row }">
              <el-tag
                size="small"
                :type="typeColor(row.type)"
                effect="plain"
              >
                {{ row.type || '-' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            prop="command"
            label="命令 / 程序"
            min-width="280"
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
            sortable
            show-overflow-tooltip
          />
          <el-table-column
            prop="enabled"
            label="启用"
            width="70"
            sortable
          >
            <template #default="{ row }">
              <el-tag
                v-if="row.enabled"
                size="small"
                type="success"
                effect="plain"
              >
                是
              </el-tag>
              <el-tag
                v-else
                size="small"
                type="info"
                effect="plain"
              >
                否
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            prop="user"
            label="用户"
            width="90"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              {{ row.user || '-' }}
            </template>
          </el-table-column>
        </el-table>
      </section>
    </div>

    <!-- 详情对话框 -->
    <el-dialog
      v-model="showDetailDialog"
      title="持久化条目详情"
      width="650px"
      destroy-on-close
    >
      <div
        v-if="detailData"
        class="detail-content"
      >
        <div
          v-for="(val, key) in detailData"
          :key="key"
          class="detail-row"
        >
          <span class="detail-key">{{ key }}</span>
          <span class="detail-val">{{ formatVal(val) }}</span>
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
import { ref, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { listPersistenceApi, queryPersistenceApi } from '@/services/api.js'
import { showWarning, handleApiError } from '@/utils/messageUtils.js'
import { useSessionParams } from '@/composables/useSessionParams.js'
import { exportTsv } from '@/utils/exportUtils.js'

const props = defineProps({
  sessionId: {
    type: String,
    required: true
  }
})

const isLoading = ref(false)
const loaded = ref(false)
const entries = ref([])
const searchText = ref('')
const onlySuspicious = ref(false)
const hideApple = ref(false)
const showDetailDialog = ref(false)
const detailData = ref(null)

const { withSession } = useSessionParams(() => props.sessionId)

const hasMacOS = computed(() => {
  return entries.value.some(e =>
    e.source && (e.source.includes('daemon') || e.source.includes('agent') || e.source === 'login-items')
  )
})

const suspiciousCount = computed(() => entries.value.filter(e => e.suspicious).length)

const filteredEntries = computed(() => {
  let list = entries.value
  if (onlySuspicious.value) {
    list = list.filter(e => e.suspicious)
  }
  if (hideApple.value) {
    list = list.filter(e => !e.name || !e.name.startsWith('com.apple.'))
  }
  if (searchText.value) {
    const kw = searchText.value.toLowerCase()
    list = list.filter(e => {
      return (e.name && e.name.toLowerCase().includes(kw)) ||
             (e.command && e.command.toLowerCase().includes(kw)) ||
             (e.path && e.path.toLowerCase().includes(kw)) ||
             (e.type && e.type.toLowerCase().includes(kw))
    })
  }
  return list
})

async function handleList() {
  isLoading.value = true
  loaded.value = true
  try {
    const res = await listPersistenceApi(withSession())
    const data = res.data
    entries.value = data.entries || []
    if (entries.value.length === 0) {
      showWarning('未发现持久化条目')
    }
  } catch (err) {
    handleApiError(err, '扫描持久化失败')
  } finally {
    isLoading.value = false
  }
}

async function handleQuery(row) {
  showDetailDialog.value = true
  detailData.value = null
  try {
    const res = await queryPersistenceApi(withSession({
      name: row.name,
      type: row.type,
      path: row.path
    }))
    const data = res.data
    detailData.value = data.detail || data
  } catch (err) {
    handleApiError(err, '查询详情失败')
    showDetailDialog.value = false
  }
}

function handleExport() {
  exportTsv(filteredEntries.value, `persistence-${Date.now()}`)
}

function typeColor(type) {
  if (!type) return 'info'
  if (type.includes('ifeo') || type.includes('wmi')) return 'danger'
  if (type.includes('registry')) return 'warning'
  if (type.includes('cron') || type.includes('rc-local')) return ''
  if (type.includes('launchd') || type.includes('systemd')) return 'success'
  if (type.includes('startup') || type.includes('login')) return 'warning'
  return 'info'
}

function formatVal(val) {
  if (val === null || val === undefined) return '-'
  if (typeof val === 'object') return JSON.stringify(val, null, 2)
  return String(val)
}
</script>

<style scoped>
.persist-workbench {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.persist-shell {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.persist-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  gap: 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  flex-wrap: wrap;
}
.toolbar-left, .toolbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.search-input {
  width: 260px;
}
.result-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}
.suspicious-count {
  color: var(--el-color-danger);
  font-weight: 500;
}
.persist-table-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.persist-table {
  font-size: 12px;
}
.entry-name {
  color: var(--el-color-primary);
  cursor: pointer;
}
.entry-name:hover {
  text-decoration: underline;
}
.suspicious-icon {
  color: var(--el-color-danger);
  margin-left: 4px;
  vertical-align: middle;
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
  gap: 8px;
  padding: 40px;
}
.empty-state p {
  margin: 0;
  font-size: 13px;
}
.hint-text {
  font-size: 11px !important;
  color: var(--el-text-color-disabled);
}

/* 详情 */
.detail-content {
  max-height: 500px;
  overflow-y: auto;
}
.detail-row {
  display: flex;
  gap: 12px;
  padding: 6px 0;
  border-bottom: 1px solid var(--el-border-color-extra-light);
  font-size: 13px;
}
.detail-key {
  min-width: 140px;
  max-width: 180px;
  font-weight: 500;
  color: var(--el-text-color-regular);
  word-break: break-all;
}
.detail-val {
  flex: 1;
  word-break: break-all;
  white-space: pre-wrap;
  color: var(--el-text-color-secondary);
}
.loading-placeholder {
  height: 200px;
}
</style>
