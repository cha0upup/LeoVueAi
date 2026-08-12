<template>
  <div class="ns-workbench">
    <div class="ns-shell">
      <!-- 工具栏 -->
      <section class="ns-toolbar">
        <div class="toolbar-left">
          <el-radio-group
            v-model="activeTab"
            size="small"
            @change="handleTabChange"
          >
            <el-radio-button value="shares">
              本机共享
            </el-radio-button>
            <el-radio-button value="mounts">
              远程挂载
            </el-radio-button>
          </el-radio-group>
          <el-button
            size="small"
            :loading="isLoading"
            @click="handleRefresh"
          >
            <el-icon>
              <Icon icon="mdi:refresh" />
            </el-icon>
            刷新
          </el-button>
          <el-input
            v-model="searchText"
            placeholder="搜索名称 / 路径"
            size="small"
            clearable
            class="search-input"
          >
            <template #prefix>
              <el-icon>
                <Icon icon="mdi:magnify" />
              </el-icon>
            </template>
          </el-input>
        </div>
        <div class="toolbar-right">
          <el-button
            v-if="activeTab === 'mounts'"
            size="small"
            text
            @click="showConnectDialog = true"
          >
            <el-icon>
              <Icon icon="mdi:plus" />
            </el-icon>
            挂载远程共享
          </el-button>
          <el-button
            size="small"
            text
            :disabled="currentFilteredList.length === 0"
            @click="handleExport"
          >
            <el-icon>
              <Icon icon="mdi:download" />
            </el-icon>
            导出
          </el-button>
        </div>
      </section>

      <!-- 共享表格 -->
      <section class="ns-table-wrap">
        <div
          v-if="!currentLoaded && !isLoading"
          class="empty-state"
        >
          <el-icon size="40">
            <Icon :icon="activeTab === 'shares' ? 'mdi:folder-network' : 'mdi:link-variant'" />
          </el-icon>
          <p>{{ activeTab === 'shares' ? '点击「刷新」枚举本机共享资源' : '点击「刷新」枚举远程挂载' }}</p>
        </div>

        <!-- 本机共享 tab -->
        <el-table
          v-else-if="activeTab === 'shares'"
          v-loading="isLoading"
          :data="filteredShares"
          stripe
          border
          size="small"
          height="100%"
          :default-sort="{ prop: 'name', order: 'ascending' }"
          highlight-current-row
          class="ns-table"
        >
          <el-table-column
            prop="name"
            label="共享名"
            min-width="160"
            sortable
            show-overflow-tooltip
          >
            <template #default="{ row }">
              <span
                class="share-name"
                @click="handleQueryShare(row.name)"
              >
                {{ row.name || '-' }}
              </span>
            </template>
          </el-table-column>
          <el-table-column
            prop="path"
            label="本地路径"
            min-width="200"
            sortable
            show-overflow-tooltip
          />
          <el-table-column
            prop="type"
            label="类型"
            width="90"
            sortable
          >
            <template #default="{ row }">
              <el-tag
                v-if="row.type"
                size="small"
                effect="plain"
              >
                {{ row.type }}
              </el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column
            prop="source"
            label="来源"
            width="100"
            sortable
          >
            <template #default="{ row }">
              <el-tag
                v-if="row.source"
                size="small"
                type="info"
                effect="plain"
              >
                {{ row.source }}
              </el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column
            prop="description"
            label="描述"
            min-width="180"
            show-overflow-tooltip
          />
          <el-table-column
            label="安全"
            width="80"
          >
            <template #default="{ row }">
              <el-tag
                v-if="row.guestOk === 'yes' || row.guestAccess === 'TRUE'"
                size="small"
                type="danger"
                effect="plain"
              >
                Guest
              </el-tag>
              <el-tag
                v-else-if="row.readOnly === 'no' || row.writable === 'yes'"
                size="small"
                type="warning"
                effect="plain"
              >
                可写
              </el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
        </el-table>

        <!-- 远程挂载 tab -->
        <el-table
          v-else
          v-loading="isLoading"
          :data="filteredMounts"
          stripe
          border
          size="small"
          height="100%"
          :default-sort="{ prop: 'remote', order: 'ascending' }"
          highlight-current-row
          class="ns-table"
        >
          <el-table-column
            prop="remote"
            label="远程路径"
            min-width="240"
            sortable
            show-overflow-tooltip
          />
          <el-table-column
            label="本地挂载"
            min-width="180"
            sortable
            show-overflow-tooltip
          >
            <template #default="{ row }">
              {{ row.local || row.mountPoint || '-' }}
            </template>
          </el-table-column>
          <el-table-column
            prop="status"
            label="状态"
            width="100"
            sortable
          >
            <template #default="{ row }">
              <el-tag
                v-if="row.status"
                size="small"
                :type="row.status.toLowerCase() === 'ok' || row.status.toLowerCase() === 'connected' ? 'success' : 'info'"
                effect="plain"
              >
                {{ row.status }}
              </el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column
            prop="fsType"
            label="文件系统"
            width="100"
            sortable
            show-overflow-tooltip
          />
          <el-table-column
            prop="network"
            label="网络类型"
            width="120"
            show-overflow-tooltip
          />
          <el-table-column
            prop="source"
            label="来源"
            width="80"
          >
            <template #default="{ row }">
              <el-tag
                v-if="row.source"
                size="small"
                type="info"
                effect="plain"
              >
                {{ row.source }}
              </el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column
            label="操作"
            width="80"
            fixed="right"
          >
            <template #default="{ row }">
              <el-popconfirm
                :title="`确认断开 '${row.local || row.mountPoint || row.remote}'？`"
                confirm-button-text="断开"
                cancel-button-text="取消"
                @confirm="handleDisconnect(row)"
              >
                <template #reference>
                  <el-button
                    type="danger"
                    size="small"
                    text
                  >
                    断开
                  </el-button>
                </template>
              </el-popconfirm>
            </template>
          </el-table-column>
        </el-table>
      </section>
    </div>

    <!-- 连接共享对话框 -->
    <el-dialog
      v-model="showConnectDialog"
      title="连接远程共享"
      width="520px"
      destroy-on-close
    >
      <el-form
        label-width="90px"
        size="small"
      >
        <el-form-item label="远程路径">
          <el-input
            v-model="connectForm.remotePath"
            placeholder="\\\\server\\share 或 //server/share 或 server:/path"
          />
        </el-form-item>
        <el-form-item label="映射盘符">
          <el-input
            v-model="connectForm.localDrive"
            placeholder="Windows: Z:（可选）"
          />
        </el-form-item>
        <el-form-item label="挂载点">
          <el-input
            v-model="connectForm.mountPoint"
            placeholder="Unix: /mnt/share（Unix 必填）"
          />
        </el-form-item>
        <el-form-item label="用户名">
          <el-input
            v-model="connectForm.username"
            placeholder="可选"
          />
        </el-form-item>
        <el-form-item label="密码">
          <el-input
            v-model="connectForm.password"
            type="password"
            show-password
            placeholder="可选"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button
          size="small"
          @click="showConnectDialog = false"
        >
          取消
        </el-button>
        <el-button
          type="primary"
          size="small"
          :loading="isLoading"
          @click="handleConnect"
        >
          连接
        </el-button>
      </template>
    </el-dialog>

    <!-- 共享详情对话框 -->
    <el-dialog
      v-model="showDetailDialog"
      title="共享详情"
      width="560px"
      destroy-on-close
    >
      <div
        v-if="shareDetail"
        class="detail-content"
      >
        <div class="detail-header">
          <span class="detail-name">{{ shareDetail.name || detailTarget }}</span>
        </div>
        <div class="detail-grid">
          <div
            v-for="(val, key) in shareDetail"
            :key="key"
            class="detail-row"
          >
            <span class="detail-key">{{ key }}</span>
            <span class="detail-val">{{ typeof val === 'object' ? JSON.stringify(val) : val }}</span>
          </div>
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
  listNetworkSharesApi,
  listNetworkMountsApi,
  queryNetworkShareApi,
  connectNetworkShareApi,
  disconnectNetworkShareApi
} from '@/services/api.js'
import { showError, showSuccess, showWarning } from '@/utils/messageUtils.js'
import { exportTsv } from '@/utils/exportUtils.js'

const props = defineProps({
  sessionId: {
    type: String,
    required: true
  }
})

// ==================== 状态 ====================

const isLoading = ref(false)
const sharesLoaded = ref(false)
const mountsLoaded = ref(false)
const activeTab = ref('shares')
const shares = ref([])
const mounts = ref([])
const searchText = ref('')
const showConnectDialog = ref(false)
const showDetailDialog = ref(false)
const shareDetail = ref(null)
const detailTarget = ref('')

const connectForm = reactive({
  remotePath: '',
  localDrive: '',
  mountPoint: '',
  username: '',
  password: ''
})

// ==================== 计算属性 ====================

const currentLoaded = computed(() => activeTab.value === 'shares' ? sharesLoaded.value : mountsLoaded.value)

const filteredShares = computed(() => {
  const q = searchText.value.trim().toLowerCase()
  if (!q) return shares.value
  return shares.value.filter(s => {
    const name = (s.name || '').toLowerCase()
    const path = (s.path || '').toLowerCase()
    const desc = (s.description || '').toLowerCase()
    return name.includes(q) || path.includes(q) || desc.includes(q)
  })
})

const filteredMounts = computed(() => {
  const q = searchText.value.trim().toLowerCase()
  if (!q) return mounts.value
  return mounts.value.filter(m => {
    const remote = (m.remote || '').toLowerCase()
    const local = (m.local || m.mountPoint || '').toLowerCase()
    return remote.includes(q) || local.includes(q)
  })
})

const currentFilteredList = computed(() =>
  activeTab.value === 'shares' ? filteredShares.value : filteredMounts.value
)

// ==================== 方法 ====================

async function handleListShares() {
  isLoading.value = true
  activeTab.value = 'shares'
  try {
    const res = await listNetworkSharesApi({ sessionId: props.sessionId })
    const data = res.data
    shares.value = data.shares || []
    sharesLoaded.value = true
    if (shares.value.length === 0) {
      showWarning('未发现本机共享资源')
    }
  } catch (err) {
    showError('获取共享列表失败: ' + (err.message || err))
  } finally {
    isLoading.value = false
  }
}

async function handleListMounts() {
  isLoading.value = true
  activeTab.value = 'mounts'
  try {
    const res = await listNetworkMountsApi({ sessionId: props.sessionId })
    const data = res.data
    mounts.value = data.mounts || []
    mountsLoaded.value = true
    if (mounts.value.length === 0) {
      showWarning('未发现已挂载的远程共享')
    }
  } catch (err) {
    showError('获取挂载列表失败: ' + (err.message || err))
  } finally {
    isLoading.value = false
  }
}

async function handleRefresh() {
  if (activeTab.value === 'shares') {
    await handleListShares()
  } else {
    await handleListMounts()
  }
}

async function handleTabChange(tab) {
  searchText.value = ''
  if (tab === 'shares' && !sharesLoaded.value) {
    await handleListShares()
  } else if (tab === 'mounts' && !mountsLoaded.value) {
    await handleListMounts()
  }
}

async function handleQueryShare(shareName) {
  if (!shareName) return
  showDetailDialog.value = true
  shareDetail.value = null
  detailTarget.value = shareName
  try {
    const res = await queryNetworkShareApi({ sessionId: props.sessionId, shareName })
    const data = res.data
    shareDetail.value = data.detail || data
  } catch (err) {
    showError('查询共享详情失败: ' + (err.message || err))
    showDetailDialog.value = false
  }
}

async function handleConnect() {
  if (!connectForm.remotePath.trim()) {
    showWarning('请输入远程共享路径')
    return
  }
  isLoading.value = true
  try {
    const params = { sessionId: props.sessionId, remotePath: connectForm.remotePath.trim() }
    if (connectForm.localDrive.trim()) params.localDrive = connectForm.localDrive.trim()
    if (connectForm.mountPoint.trim()) params.mountPoint = connectForm.mountPoint.trim()
    if (connectForm.username.trim()) params.username = connectForm.username.trim()
    if (connectForm.password) params.password = connectForm.password

    await connectNetworkShareApi(params)
    showSuccess('共享连接命令已执行')
    showConnectDialog.value = false
    connectForm.remotePath = ''
    connectForm.localDrive = ''
    connectForm.mountPoint = ''
    connectForm.username = ''
    connectForm.password = ''
    // 刷新挂载列表
    await handleListMounts()
  } catch (err) {
    showError('连接共享失败: ' + (err.message || err))
  } finally {
    isLoading.value = false
  }
}

async function handleDisconnect(row) {
  const target = row.local || row.mountPoint || row.remote
  if (!target) return
  try {
    await disconnectNetworkShareApi({ sessionId: props.sessionId, target })
    showSuccess('已断开共享: ' + target)
    mounts.value = mounts.value.filter(m => m !== row)
  } catch (err) {
    showError('断开共享失败: ' + (err.message || err))
  }
}

function handleExport() {
  if (activeTab.value === 'shares') {
    exportTsv(filteredShares.value, 'network_shares', [
      { label: 'Name', key: 'name' },
      { label: 'Path', key: 'path' },
      { label: 'Type', key: 'type' },
      { label: 'Source', key: 'source' },
      { label: 'Description', key: 'description' }
    ])
  } else {
    exportTsv(filteredMounts.value, 'network_mounts', [
      { label: 'Remote', key: 'remote' },
      { label: 'Local', key: m => m.local || m.mountPoint || '' },
      { label: 'Status', key: 'status' },
      { label: 'FsType', key: 'fsType' },
      { label: 'Network', key: 'network' },
      { label: 'Source', key: 'source' }
    ])
  }
}
</script>

<style scoped>
.ns-workbench {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
}

.ns-shell {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.ns-toolbar {
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

.ns-table-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.ns-table {
  font-size: 12px;
}

.share-name {
  color: var(--el-color-primary);
  cursor: pointer;
}

.share-name:hover {
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
  margin-bottom: 12px;
}

.detail-name {
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
  width: 160px;
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

.detail-val {
  word-break: break-all;
  color: var(--el-text-color-regular);
}

.loading-placeholder {
  height: 200px;
}
</style>
