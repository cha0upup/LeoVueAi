<template>
  <div class="svc-workbench">
    <div class="svc-shell">
      <!-- 工具栏 -->
      <section class="svc-toolbar">
        <div class="toolbar-left">
          <el-input
            v-model="searchText"
            placeholder="过滤服务名 / 显示名"
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
            {{ loaded ? '刷新' : '加载全部服务' }}
          </el-button>
          <el-select
            v-model="statusFilter"
            placeholder="状态筛选"
            size="small"
            clearable
            style="width: 130px"
          >
            <el-option
              label="Running"
              value="running"
            />
            <el-option
              label="Stopped"
              value="stopped"
            />
            <el-option
              label="Active"
              value="active"
            />
            <el-option
              label="Inactive"
              value="inactive"
            />
            <el-option
              label="Failed"
              value="failed"
            />
          </el-select>
        </div>
        <div class="toolbar-right">
          <span
            v-if="filteredServices.length > 0"
            class="result-count"
          >
            {{ filteredServices.length }} / {{ services.length }} 个服务
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
            :disabled="!filteredServices.length"
            @click="handleExport"
          >
            <el-icon><Icon icon="mdi:download" /></el-icon>
            导出
          </el-button>
        </div>
      </section>

      <!-- 服务表格 -->
      <section class="svc-table-wrap">
        <div
          v-if="!loaded && !isLoading"
          class="empty-state"
        >
          <el-icon size="40">
            <Icon icon="mdi:cogs" />
          </el-icon>
          <p>点击「加载全部服务」加载远程主机的服务列表</p>
        </div>

        <el-table
          v-else
          v-loading="isLoading"
          :data="filteredServices"
          stripe
          border
          size="small"
          height="100%"
          :default-sort="{ prop: 'serviceName', order: 'ascending' }"
          highlight-current-row
          class="svc-table"
          @sort-change="handleSortChange"
        >
          <el-table-column
            prop="serviceName"
            label="服务名"
            min-width="180"
            sortable="custom"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              <span
                class="svc-name"
                @click="handleQueryDetail(row.serviceName)"
              >
                {{ row.serviceName }}
              </span>
            </template>
          </el-table-column>
          <el-table-column
            prop="displayName"
            label="显示名"
            min-width="220"
            sortable="custom"
            show-overflow-tooltip
          />
          <el-table-column
            prop="status"
            label="状态"
            width="100"
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
            prop="startType"
            label="启动类型"
            width="120"
            sortable="custom"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              <el-tag
                v-if="row.startType"
                size="small"
                :type="startTypeColor(row.startType)"
                effect="plain"
              >
                {{ row.startType }}
              </el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column
            label="操作"
            width="220"
            fixed="right"
          >
            <template #default="{ row }">
              <el-button
                size="small"
                text
                type="success"
                @click="handleControl(row.serviceName, 'start')"
              >
                启动
              </el-button>
              <el-popconfirm
                :title="`确认停止服务 '${row.serviceName}'？`"
                confirm-button-text="停止"
                cancel-button-text="取消"
                @confirm="handleControl(row.serviceName, 'stop')"
              >
                <template #reference>
                  <el-button
                    size="small"
                    text
                    type="warning"
                  >
                    停止
                  </el-button>
                </template>
              </el-popconfirm>
              <el-popconfirm
                :title="`确认重启服务 '${row.serviceName}'？`"
                confirm-button-text="重启"
                cancel-button-text="取消"
                @confirm="handleControl(row.serviceName, 'restart')"
              >
                <template #reference>
                  <el-button
                    size="small"
                    text
                    type="primary"
                  >
                    重启
                  </el-button>
                </template>
              </el-popconfirm>
              <el-popconfirm
                :title="`确认删除服务 '${row.serviceName}'？此操作不可逆！`"
                confirm-button-text="删除"
                cancel-button-text="取消"
                @confirm="handleDelete(row.serviceName)"
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

    <!-- 创建服务对话框 -->
    <el-dialog
      v-model="showCreateDialog"
      title="创建系统服务"
      width="520px"
      destroy-on-close
    >
      <el-form
        label-width="90px"
        size="small"
      >
        <el-form-item label="服务名">
          <el-input
            v-model="createForm.serviceName"
            placeholder="如 MyService"
          />
        </el-form-item>
        <el-form-item label="可执行路径">
          <el-input
            v-model="createForm.binPath"
            placeholder="如 C:\\app\\svc.exe 或 /usr/bin/myapp"
          />
        </el-form-item>
        <el-form-item label="显示名称">
          <el-input
            v-model="createForm.displayName"
            placeholder="可选，服务显示名"
          />
        </el-form-item>
        <el-form-item label="启动类型">
          <el-select
            v-model="createForm.startType"
            style="width: 100%"
          >
            <el-option
              label="demand (手动)"
              value="demand"
            />
            <el-option
              label="auto (自动)"
              value="auto"
            />
            <el-option
              label="disabled (禁用)"
              value="disabled"
            />
          </el-select>
        </el-form-item>
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

    <!-- 服务详情对话框 -->
    <el-dialog
      v-model="showDetailDialog"
      title="服务详情"
      width="600px"
      destroy-on-close
    >
      <div
        v-if="serviceDetail"
        class="detail-content"
      >
        <div class="detail-header">
          <span class="detail-svc-name">{{ serviceDetail.serviceName || detailTarget }}</span>
          <el-tag
            v-if="serviceDetail.status"
            size="small"
            :type="statusColor(serviceDetail.status)"
          >
            {{ serviceDetail.status }}
          </el-tag>
        </div>
        <div
          v-if="serviceDetail.detail"
          class="detail-grid"
        >
          <div
            v-for="(val, key) in serviceDetail.detail"
            :key="key"
            class="detail-row"
          >
            <span class="detail-key">{{ key }}</span>
            <span class="detail-val">{{ val }}</span>
          </div>
        </div>
        <div
          v-if="serviceDetail.rawOutput"
          class="raw-output"
        >
          <el-collapse>
            <el-collapse-item title="原始输出">
              <pre class="raw-pre">{{ serviceDetail.rawOutput }}</pre>
            </el-collapse-item>
          </el-collapse>
        </div>

        <!-- 操作按钮区 -->
        <div class="detail-actions">
          <el-button
            size="small"
            type="success"
            @click="handleControl(detailTarget, 'start')"
          >
            启动
          </el-button>
          <el-popconfirm
            :title="`确认停止服务 '${detailTarget}'？`"
            confirm-button-text="停止"
            cancel-button-text="取消"
            @confirm="handleControl(detailTarget, 'stop')"
          >
            <template #reference>
              <el-button
                size="small"
                type="warning"
              >
                停止
              </el-button>
            </template>
          </el-popconfirm>
          <el-popconfirm
            :title="`确认重启服务 '${detailTarget}'？`"
            confirm-button-text="重启"
            cancel-button-text="取消"
            @confirm="handleControl(detailTarget, 'restart')"
          >
            <template #reference>
              <el-button
                size="small"
                type="primary"
              >
                重启
              </el-button>
            </template>
          </el-popconfirm>
          <el-divider direction="vertical" />
          <el-button
            size="small"
            @click="handleToggleAutoStart(detailTarget, true)"
          >
            启用自启
          </el-button>
          <el-popconfirm
            :title="`确认禁用服务 '${detailTarget}' 的开机自启？`"
            confirm-button-text="禁用"
            cancel-button-text="取消"
            @confirm="handleToggleAutoStart(detailTarget, false)"
          >
            <template #reference>
              <el-button size="small">
                禁用自启
              </el-button>
            </template>
          </el-popconfirm>
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
  listServicesApi,
  queryServiceApi,
  startServiceApi,
  stopServiceApi,
  restartServiceApi,
  toggleServiceAutoStartApi,
  createServiceApi,
  deleteServiceApi
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
const services = ref([])
const searchText = ref('')
const statusFilter = ref('')
const sortState = ref({ prop: 'serviceName', order: 'ascending' })
const showCreateDialog = ref(false)
const showDetailDialog = ref(false)
const serviceDetail = ref(null)
const detailTarget = ref('')

const createForm = reactive({
  serviceName: '',
  binPath: '',
  displayName: '',
  startType: 'demand'
})

// ==================== 计算属性 ====================

const filteredServices = computed(() => {
  let list = [...services.value]
  const q = searchText.value.trim().toLowerCase()
  if (q) {
    list = list.filter(s => {
      const name = (s.serviceName || '').toLowerCase()
      const display = (s.displayName || '').toLowerCase()
      return name.includes(q) || display.includes(q)
    })
  }
  if (statusFilter.value) {
    const f = statusFilter.value.toLowerCase()
    list = list.filter(s => (s.status || '').toLowerCase().includes(f))
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
    const res = await listServicesApi({ sessionId: props.sessionId })
    const data = res.data
    services.value = data.services || []
    if (services.value.length === 0) {
      showWarning('未获取到服务列表')
    }
  } catch (err) {
    showError('获取服务列表失败: ' + (err.message || err))
  } finally {
    isLoading.value = false
  }
}

function handleSearch() {
  if (!loaded.value) {
    handleListAll()
  }
}

async function handleQueryDetail(serviceName) {
  showDetailDialog.value = true
  serviceDetail.value = null
  detailTarget.value = serviceName
  try {
    const res = await queryServiceApi({ sessionId: props.sessionId, serviceName })
    serviceDetail.value = res.data
  } catch (err) {
    showError('查询服务详情失败: ' + (err.message || err))
    showDetailDialog.value = false
  }
}

async function handleControl(serviceName, operation) {
  if (!serviceName) return
  try {
    if (operation === 'start') {
      await startServiceApi({ sessionId: props.sessionId, serviceName })
    } else if (operation === 'stop') {
      await stopServiceApi({ sessionId: props.sessionId, serviceName })
    } else if (operation === 'restart') {
      await restartServiceApi({ sessionId: props.sessionId, serviceName })
    }
    const opLabel = { start: '启动', stop: '停止', restart: '重启' }[operation]
    showSuccess(`${opLabel}服务 '${serviceName}' 成功`)
    // 刷新列表
    if (loaded.value) await handleListAll()
    // 如果详情对话框打开中，刷新详情
    if (showDetailDialog.value && detailTarget.value === serviceName) {
      await handleQueryDetail(serviceName)
    }
  } catch (err) {
    showError('操作失败: ' + (err.message || err))
  }
}

async function handleToggleAutoStart(serviceName, enable) {
  if (!serviceName) return
  try {
    await toggleServiceAutoStartApi({ sessionId: props.sessionId, serviceName, enable })
    showSuccess(`服务 '${serviceName}' 已${enable ? '启用' : '禁用'}开机自启`)
    if (loaded.value) await handleListAll()
    if (showDetailDialog.value && detailTarget.value === serviceName) {
      await handleQueryDetail(serviceName)
    }
  } catch (err) {
    showError('操作失败: ' + (err.message || err))
  }
}

async function handleCreate() {
  if (!createForm.serviceName.trim()) {
    showWarning('请输入服务名称')
    return
  }
  if (!createForm.binPath.trim()) {
    showWarning('请输入可执行文件路径')
    return
  }

  isLoading.value = true
  try {
    const params = {
      sessionId: props.sessionId,
      serviceName: createForm.serviceName,
      binPath: createForm.binPath,
      startType: createForm.startType
    }
    if (createForm.displayName) params.displayName = createForm.displayName

    await createServiceApi(params)
    showSuccess('服务已创建')
    showCreateDialog.value = false
    if (loaded.value) await handleListAll()
  } catch (err) {
    showError('创建服务失败: ' + (err.message || err))
  } finally {
    isLoading.value = false
  }
}

async function handleDelete(serviceName) {
  try {
    await deleteServiceApi({ sessionId: props.sessionId, serviceName })
    showSuccess(`服务 '${serviceName}' 已删除`)
    services.value = services.value.filter(s => s.serviceName !== serviceName)
  } catch (err) {
    showError('删除服务失败: ' + (err.message || err))
  }
}

function handleSortChange({ prop, order }) {
  sortState.value = { prop, order }
}

function handleExport() {
  if (filteredServices.value.length === 0) return
  const header = 'ServiceName\tDisplayName\tStatus\tStartType\n'
  const rows = filteredServices.value.map(s =>
    [
      s.serviceName || '',
      s.displayName || '',
      s.status || '',
      s.startType || ''
    ].join('\t')
  ).join('\n')
  const blob = new Blob([header + rows], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'services.tsv'
  a.click()
  URL.revokeObjectURL(url)
}

function statusColor(status) {
  if (!status) return 'info'
  const s = status.toLowerCase()
  if (s.includes('running') || s.includes('active') || s === '运行') return 'success'
  if (s.includes('stopped') || s.includes('inactive') || s === '停止') return 'info'
  if (s.includes('failed') || s.includes('error')) return 'danger'
  if (s.includes('starting') || s.includes('stopping')) return 'warning'
  return 'info'
}

function startTypeColor(type) {
  if (!type) return 'info'
  const t = type.toLowerCase()
  if (t.includes('auto') || t.includes('enabled')) return 'success'
  if (t.includes('disabled') || t.includes('禁用')) return 'danger'
  if (t.includes('demand') || t.includes('manual') || t.includes('手动')) return 'warning'
  return 'info'
}
</script>

<style scoped>
.svc-workbench {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
}

.svc-shell {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.svc-toolbar {
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

.svc-table-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.svc-table {
  font-size: 12px;
}

.svc-name {
  color: var(--el-color-primary);
  cursor: pointer;
}

.svc-name:hover {
  text-decoration: underline;
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

.detail-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.detail-svc-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
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

.detail-actions {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
  display: flex;
  align-items: center;
  gap: 8px;
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
