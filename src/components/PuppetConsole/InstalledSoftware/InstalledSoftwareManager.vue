<template>
  <div class="sw-workbench">
    <div class="sw-shell">
      <!-- 工具栏 -->
      <section class="sw-toolbar">
        <div class="toolbar-left">
          <el-button
            type="primary"
            size="small"
            :loading="isLoading"
            @click="handleLoad"
          >
            <el-icon><Icon icon="mdi:package-variant" /></el-icon>
            {{ loaded ? '重新加载' : '加载软件列表' }}
          </el-button>
          <el-divider direction="vertical" />
          <el-radio-group
            v-model="filterType"
            size="small"
            :disabled="!loaded"
            @change="handleFilterChange"
          >
            <el-radio-button value="all">
              全部
            </el-radio-button>
            <el-radio-button value="system">
              系统包
            </el-radio-button>
            <el-radio-button value="user">
              用户包
            </el-radio-button>
          </el-radio-group>
          <el-divider direction="vertical" />
          <el-input
            v-model="searchText"
            placeholder="搜索软件名称"
            size="small"
            clearable
            class="search-input"
          >
            <template #prefix>
              <el-icon><Icon icon="mdi:magnify" /></el-icon>
            </template>
          </el-input>
        </div>
        <div class="toolbar-right">
          <span
            v-if="displayList.length > 0"
            class="result-count"
          >
            {{ displayList.length }} / {{ allItems.length }} 个软件
          </span>
          <el-button
            size="small"
            text
            :disabled="!displayList.length"
            @click="handleExport"
          >
            <el-icon><Icon icon="mdi:download" /></el-icon>
            导出
          </el-button>
        </div>
      </section>

      <!-- 软件表格 -->
      <section class="sw-table-wrap">
        <div
          v-if="!loaded && !isLoading"
          class="empty-state"
        >
          <el-icon size="40">
            <Icon icon="mdi:package-variant" />
          </el-icon>
          <p>点击「加载软件列表」枚举目标主机上的已安装软件</p>
        </div>

        <el-table
          v-else
          v-loading="isLoading"
          :data="sortedList"
          stripe
          border
          size="small"
          height="100%"
          :default-sort="{ prop: 'name', order: 'ascending' }"
          highlight-current-row
          class="sw-table"
          @sort-change="handleSortChange"
        >
          <el-table-column
            prop="name"
            label="名称"
            min-width="220"
            sortable="custom"
            show-overflow-tooltip
          />
          <el-table-column
            prop="version"
            label="版本"
            width="180"
            sortable="custom"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              {{ row.version || '-' }}
            </template>
          </el-table-column>
          <el-table-column
            prop="vendor"
            label="厂商"
            width="160"
            sortable="custom"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              {{ row.vendor || '-' }}
            </template>
          </el-table-column>
          <el-table-column
            prop="source"
            label="来源"
            width="110"
            sortable="custom"
          >
            <template #default="{ row }">
              <el-tag
                size="small"
                :type="sourceTagType(row.source)"
              >
                {{ row.source }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            prop="group"
            label="分组"
            width="90"
            sortable="custom"
          >
            <template #default="{ row }">
              <el-tag
                size="small"
                :type="row.group === 'system' ? 'danger' : 'warning'"
              >
                {{ row.group === 'system' ? '系统' : '用户' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            prop="status"
            label="状态"
            width="140"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              {{ row.status || '-' }}
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
import { listAllSoftwareApi } from '@/services/api.js'
import { showError, showWarning, showSuccess } from '@/utils/messageUtils.js'
import { exportTsv } from '@/utils/exportUtils.js'

// ── 解包 Component 返回的 {code, data} 信封 ──
function unwrap(res) {
  let d = res.data
  if (d && typeof d === 'object' && 'code' in d && 'data' in d) {
    d = d.data
  }
  return d || {}
}

const props = defineProps({
  sessionId: {
    type: String,
    required: true
  }
})

// ==================== 状态 ====================

const isLoading = ref(false)
const loaded = ref(false)
const filterType = ref('all')
const searchText = ref('')
const sortState = ref({ prop: 'name', order: 'ascending' })

// 全量数据（一次拉取，前端过滤）
const allItems = ref([])

// ==================== 计算属性 ====================

// 按分组 + 搜索词过滤
const displayList = computed(() => {
  let list = allItems.value
  // 按分组过滤
  if (filterType.value !== 'all') {
    list = list.filter(item => item.group === filterType.value)
  }
  // 按搜索词过滤
  if (searchText.value.trim()) {
    const q = searchText.value.trim().toLowerCase()
    list = list.filter(item =>
      (item.name && item.name.toLowerCase().includes(q)) ||
      (item.version && item.version.toLowerCase().includes(q)) ||
      (item.vendor && item.vendor.toLowerCase().includes(q)) ||
      (item.source && item.source.toLowerCase().includes(q))
    )
  }
  return list
})

// 排序
const sortedList = computed(() => {
  const list = [...displayList.value]
  const { prop, order } = sortState.value
  if (!prop || !order) return list

  list.sort((a, b) => {
    let va = a[prop] ?? ''
    let vb = b[prop] ?? ''
    const cmp = String(va).localeCompare(String(vb))
    return order === 'ascending' ? cmp : -cmp
  })
  return list
})

// ==================== 方法 ====================

function flattenResult(rawData) {
  const items = []
  const groups = ['system', 'user']
  for (const group of groups) {
    const groupData = rawData[group]
    if (!groupData) continue
    for (const [source, info] of Object.entries(groupData)) {
      if (info && info.packages && Array.isArray(info.packages)) {
        for (const pkg of info.packages) {
          items.push({ ...pkg, source: info.source || source, group })
        }
      }
    }
  }
  return items
}

async function handleLoad() {
  isLoading.value = true
  loaded.value = true
  filterType.value = 'all'
  searchText.value = ''
  try {
    const res = await listAllSoftwareApi({ sessionId: props.sessionId })
    const data = unwrap(res)
    allItems.value = flattenResult(data)
    if (allItems.value.length === 0) {
      showWarning('未发现已安装软件')
    } else {
      const sysCount = allItems.value.filter(i => i.group === 'system').length
      const userCount = allItems.value.filter(i => i.group === 'user').length
      showSuccess('发现 ' + allItems.value.length + ' 个软件（系统 ' + sysCount + ' / 用户 ' + userCount + '）')
    }
  } catch (err) {
    showError('获取软件列表失败: ' + (err.message || err))
  } finally {
    isLoading.value = false
  }
}

function handleFilterChange() {
  // 纯前端过滤，无需任何操作，computed 自动响应
}

function handleSortChange({ prop, order }) {
  sortState.value = { prop, order }
}

function sourceTagType(source) {
  if (!source) return 'info'
  const s = source.toLowerCase()
  if (s.includes('dpkg') || s.includes('rpm') || s.includes('wmic') || s.includes('registry') || s.includes('pkgutil')) return ''
  if (s.includes('pip') || s.includes('npm') || s.includes('gem')) return 'warning'
  if (s.includes('snap') || s.includes('flatpak') || s.includes('brew')) return 'success'
  return 'info'
}

function handleExport() {
  if (displayList.value.length === 0) return
  exportTsv(displayList.value, 'installed-software.tsv', ['name', 'version', 'vendor', 'source', 'group', 'status'])
}
</script>

<style scoped>
.sw-workbench {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
}

.sw-shell {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* ── 工具栏 ── */
.sw-toolbar {
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
  width: 220px;
}

.result-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

/* ── 表格区域 ── */
.sw-table-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.sw-table {
  font-size: 12px;
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
