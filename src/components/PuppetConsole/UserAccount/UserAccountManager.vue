<template>
  <div class="ua-workbench">
    <div class="ua-shell">
      <!-- 工具栏 -->
      <section class="ua-toolbar">
        <div class="toolbar-left">
          <el-button
            type="primary"
            size="small"
            :loading="isLoading"
            @click="handleWhoami"
          >
            <el-icon><Icon icon="mdi:account-check" /></el-icon>
            当前身份
          </el-button>
          <el-radio-group
            v-model="activeTab"
            size="small"
            @change="handleTabChange"
          >
            <el-radio-button value="users">
              用户列表
            </el-radio-button>
            <el-radio-button value="groups">
              组列表
            </el-radio-button>
          </el-radio-group>
          <el-button
            size="small"
            :loading="currentLoading"
            @click="handleRefresh"
          >
            <el-icon><Icon icon="mdi:refresh" /></el-icon>
            刷新
          </el-button>
          <el-checkbox
            v-model="hideSystem"
            size="small"
            style="margin-left: 8px"
          >
            隐藏系统账户
          </el-checkbox>
        </div>
        <div class="toolbar-right">
          <el-input
            v-model="searchText"
            placeholder="搜索用户/组"
            size="small"
            clearable
            class="search-input"
          >
            <template #prefix>
              <el-icon><Icon icon="mdi:magnify" /></el-icon>
            </template>
          </el-input>
          <el-button
            size="small"
            text
            :disabled="!currentList.length"
            @click="handleExport"
          >
            <el-icon><Icon icon="mdi:download" /></el-icon>
            导出
          </el-button>
        </div>
      </section>

      <!-- 主内容区 -->
      <section class="ua-content">
        <!-- whoami 信息卡片 -->
        <div
          v-if="whoamiData"
          class="whoami-card"
        >
          <div class="whoami-header">
            <el-icon size="18">
              <Icon icon="mdi:shield-account" />
            </el-icon>
            <span>当前身份: {{ whoamiData.user || '-' }}</span>
            <el-tag
              v-if="whoamiData.isRoot || whoamiData.isAdmin"
              size="small"
              type="danger"
              effect="plain"
            >
              {{ whoamiData.isRoot ? 'ROOT' : 'ADMIN' }}
            </el-tag>
            <el-tag
              v-if="whoamiData.sudoNoPassword"
              size="small"
              type="warning"
              effect="plain"
            >
              sudo 免密
            </el-tag>
            <el-button
              size="small"
              text
              style="margin-left: auto"
              aria-label="关闭当前用户信息"
              @click="whoamiData = null"
            >
              <el-icon><Icon icon="mdi:close" /></el-icon>
            </el-button>
          </div>
          <div class="whoami-body">
            <div
              v-for="(val, key) in whoamiDisplay"
              :key="key"
              class="whoami-row"
            >
              <span class="wk">{{ key }}</span>
              <span class="wv">{{ val }}</span>
            </div>
          </div>
        </div>

        <!-- 表格区 -->
        <div class="table-area">
          <div
            v-if="!currentLoaded && !currentLoading"
            class="empty-state"
          >
            <el-icon size="40">
              <Icon icon="mdi:account-group" />
            </el-icon>
            <p>{{ activeTab === 'users' ? '点击「刷新」枚举用户列表' : '点击「刷新」枚举组列表' }}</p>
            <p
              v-if="osInfo"
              class="os-hint"
            >
              目标系统: {{ osInfo }}
            </p>
          </div>

          <!-- 用户表 -->
          <el-table
            v-if="activeTab === 'users' && usersLoaded"
            v-loading="isLoadingUsers"
            :data="filteredUsers"
            stripe
            border
            size="small"
            height="100%"
            highlight-current-row
            class="ua-table"
            :default-sort="{ prop: 'name', order: 'ascending' }"
          >
            <el-table-column
              prop="name"
              label="用户名"
              min-width="140"
              sortable
              show-overflow-tooltip
            >
              <template #default="{ row }">
                <span
                  class="user-link"
                  @click="handleQueryUser(row.name)"
                >{{ row.name }}</span>
              </template>
            </el-table-column>
            <el-table-column
              prop="uid"
              label="UID"
              width="70"
              sortable
            />
            <el-table-column
              prop="fullName"
              label="全名"
              min-width="120"
              show-overflow-tooltip
            />
            <el-table-column
              prop="home"
              label="Home"
              min-width="180"
              show-overflow-tooltip
            />
            <el-table-column
              prop="shell"
              label="Shell"
              min-width="140"
              show-overflow-tooltip
            />
            <el-table-column
              label="状态"
              width="100"
            >
              <template #default="{ row }">
                <el-tag
                  v-if="row.system"
                  size="small"
                  type="info"
                  effect="plain"
                >
                  系统
                </el-tag>
                <el-tag
                  v-else-if="row.disabled === 'TRUE'"
                  size="small"
                  type="danger"
                  effect="plain"
                >
                  禁用
                </el-tag>
                <el-tag
                  v-else
                  size="small"
                  type="success"
                  effect="plain"
                >
                  正常
                </el-tag>
              </template>
            </el-table-column>
          </el-table>

          <!-- 组表 -->
          <el-table
            v-if="activeTab === 'groups' && groupsLoaded"
            v-loading="isLoadingGroups"
            :data="filteredGroups"
            stripe
            border
            size="small"
            height="100%"
            highlight-current-row
            class="ua-table"
            :default-sort="{ prop: 'name', order: 'ascending' }"
          >
            <el-table-column
              prop="name"
              label="组名"
              min-width="180"
              sortable
              show-overflow-tooltip
            >
              <template #default="{ row }">
                <span
                  class="user-link"
                  @click="handleQueryGroup(row.name)"
                >{{ row.name }}</span>
              </template>
            </el-table-column>
            <el-table-column
              prop="gid"
              label="GID"
              width="70"
              sortable
            />
            <el-table-column
              prop="members"
              label="成员"
              min-width="300"
              show-overflow-tooltip
            />
            <el-table-column
              label="类型"
              width="80"
            >
              <template #default="{ row }">
                <el-tag
                  v-if="row.system"
                  size="small"
                  type="info"
                  effect="plain"
                >
                  系统
                </el-tag>
                <el-tag
                  v-else
                  size="small"
                  effect="plain"
                >
                  用户
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </section>

      <!-- 用户/组详情对话框 -->
      <el-dialog
        v-model="showDetailDialog"
        :title="detailTitle"
        width="620"
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
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Icon } from '@iconify/vue'
import {
  listUsersApi,
  listGroupsApi,
  queryUserApi,
  queryGroupApi,
  whoamiApi
} from '@/services/api'
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
const isLoadingUsers = ref(false)
const isLoadingGroups = ref(false)
const usersLoaded = ref(false)
const groupsLoaded = ref(false)
const activeTab = ref('users')
const showDetailDialog = ref(false)
const hideSystem = ref(true)
const searchText = ref('')

const users = ref([])
const groups = ref([])
const whoamiData = ref(null)
const detailData = ref(null)
const detailTitle = ref('')
const osInfo = ref('')

const { withSession } = useSessionParams(() => props.sessionId)

const whoamiDisplay = computed(() => {
  if (!whoamiData.value) return {}
  const d = { ...whoamiData.value }
  // 排除过长的 whoamiAll
  if (d.whoamiAll && d.whoamiAll.length > 500) {
    d.whoamiAll = d.whoamiAll.substring(0, 500) + '...'
  }
  return d
})

const filteredUsers = computed(() => {
  let list = users.value
  if (hideSystem.value) {
    list = list.filter(u => !u.system)
  }
  if (searchText.value) {
    const kw = searchText.value.toLowerCase()
    list = list.filter(u => {
      return (u.name && u.name.toLowerCase().includes(kw)) ||
             (u.fullName && u.fullName.toLowerCase().includes(kw)) ||
             (u.home && u.home.toLowerCase().includes(kw))
    })
  }
  return list
})

const filteredGroups = computed(() => {
  let list = groups.value
  if (hideSystem.value) {
    list = list.filter(g => !g.system)
  }
  if (searchText.value) {
    const kw = searchText.value.toLowerCase()
    list = list.filter(g => {
      return (g.name && g.name.toLowerCase().includes(kw)) ||
             (g.members && g.members.toLowerCase().includes(kw))
    })
  }
  return list
})

const currentList = computed(() => activeTab.value === 'users' ? filteredUsers.value : filteredGroups.value)
const currentLoading = computed(() => activeTab.value === 'users' ? isLoadingUsers.value : isLoadingGroups.value)
const currentLoaded = computed(() => activeTab.value === 'users' ? usersLoaded.value : groupsLoaded.value)

async function handleWhoami() {
  isLoading.value = true
  try {
    const res = await whoamiApi(withSession())
    const data = res.data
    whoamiData.value = data.detail || data
    osInfo.value = data.os || ''
  } catch (e) {
    handleApiError(e, '获取身份信息失败')
  } finally {
    isLoading.value = false
  }
}

async function handleListUsers() {
  isLoadingUsers.value = true
  activeTab.value = 'users'
  try {
    const res = await listUsersApi(withSession())
    const data = res.data
    users.value = data.users || []
    usersLoaded.value = true
    osInfo.value = data.os || osInfo.value
    if (!users.value.length) showWarning('未找到用户')
  } catch (e) {
    handleApiError(e, '获取用户列表失败')
  } finally {
    isLoadingUsers.value = false
  }
}

async function handleListGroups() {
  isLoadingGroups.value = true
  activeTab.value = 'groups'
  try {
    const res = await listGroupsApi(withSession())
    const data = res.data
    groups.value = data.groups || []
    groupsLoaded.value = true
    osInfo.value = data.os || osInfo.value
    if (!groups.value.length) showWarning('未找到组')
  } catch (e) {
    handleApiError(e, '获取组列表失败')
  } finally {
    isLoadingGroups.value = false
  }
}

async function handleRefresh() {
  if (activeTab.value === 'users') {
    await handleListUsers()
  } else {
    await handleListGroups()
  }
}

async function handleTabChange(tab) {
  searchText.value = ''
  if (tab === 'users' && !usersLoaded.value) {
    await handleListUsers()
  } else if (tab === 'groups' && !groupsLoaded.value) {
    await handleListGroups()
  }
}

async function handleQueryUser(username) {
  detailTitle.value = '用户详情: ' + username
  detailData.value = null
  showDetailDialog.value = true
  try {
    const res = await queryUserApi(withSession({ username }))
    const data = res.data
    detailData.value = data.detail || data
  } catch (e) {
    handleApiError(e, '查询用户失败')
    showDetailDialog.value = false
  }
}

async function handleQueryGroup(groupName) {
  detailTitle.value = '组详情: ' + groupName
  detailData.value = null
  showDetailDialog.value = true
  try {
    const res = await queryGroupApi(withSession({ groupName }))
    const data = res.data
    detailData.value = data.detail || data
  } catch (e) {
    handleApiError(e, '查询组失败')
    showDetailDialog.value = false
  }
}

function handleExport() {
  exportTsv(currentList.value, `${activeTab.value}-${Date.now()}`)
}

function formatVal(val) {
  if (val === null || val === undefined) return '-'
  if (typeof val === 'object') return JSON.stringify(val, null, 2)
  return String(val)
}
</script>

<style scoped>
.ua-workbench {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.ua-shell {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.ua-toolbar {
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
  width: 180px;
}
.ua-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

/* whoami 卡片 */
.whoami-card {
  border-bottom: 1px solid var(--el-border-color-lighter);
  max-height: 200px;
  overflow-y: auto;
}
.whoami-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 14px;
  font-weight: 500;
  background: var(--el-fill-color-light);
}
.whoami-body {
  padding: 4px 12px 8px;
}
.whoami-row {
  display: flex;
  gap: 12px;
  padding: 2px 0;
  font-size: 12px;
}
.wk {
  min-width: 100px;
  color: var(--el-text-color-secondary);
  font-weight: 500;
}
.wv {
  flex: 1;
  word-break: break-all;
  white-space: pre-wrap;
}

/* 表格区 */
.table-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--el-text-color-placeholder);
}
.empty-state p {
  margin: 0;
  font-size: 14px;
}
.os-hint {
  font-size: 12px !important;
  color: var(--el-text-color-disabled);
}
.ua-table {
  flex: 1;
}
.user-link {
  color: var(--el-color-primary);
  cursor: pointer;
}
.user-link:hover {
  text-decoration: underline;
}
.result-bar {
  padding: 6px 12px;
  border-top: 1px solid var(--el-border-color-lighter);
  display: flex;
  align-items: center;
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
