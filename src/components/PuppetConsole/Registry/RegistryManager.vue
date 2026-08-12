<template>
  <div class="registry-workbench">
    <div class="registry-shell">
      <!-- 工具栏 -->
      <section class="registry-toolbar">
        <div class="toolbar-left">
          <el-input
            v-model="keyPath"
            placeholder="注册表路径，如 HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run"
            size="small"
            clearable
            class="path-input"
            @keyup.enter="handleQuery"
          >
            <template #prefix>
              <el-icon><Icon icon="mdi:key-outline" /></el-icon>
            </template>
          </el-input>
          <el-button
            type="primary"
            size="small"
            :loading="isLoading"
            @click="handleQuery"
          >
            <el-icon><Icon icon="mdi:magnify" /></el-icon>
            查询
          </el-button>
          <el-checkbox
            v-model="recursive"
            size="small"
          >
            递归
          </el-checkbox>
        </div>
        <div class="toolbar-right">
          <el-button
            size="small"
            text
            @click="showSearchDialog = true"
          >
            <el-icon><Icon icon="mdi:text-search" /></el-icon>
            搜索
          </el-button>
          <el-button
            size="small"
            text
            @click="openAddDialog"
          >
            <el-icon><Icon icon="mdi:plus" /></el-icon>
            新建值
          </el-button>
          <el-button
            size="small"
            text
            :disabled="!entries.length || resultMode !== 'query'"
            @click="handleExport"
          >
            <el-icon><Icon icon="mdi:download" /></el-icon>
            导出
          </el-button>
        </div>
      </section>

      <!-- 快捷路径 -->
      <section class="quick-paths">
        <el-tag
          v-for="qp in quickPaths"
          :key="qp.path"
          size="small"
          class="quick-path-tag"
          effect="plain"
          @click="navigateTo(qp.path)"
        >
          {{ qp.label }}
        </el-tag>
      </section>

      <!-- 注册表内容 -->
      <section class="registry-content-wrap">
        <div
          v-if="!loaded && !isLoading"
          class="empty-state"
        >
          <el-icon size="40">
            <Icon icon="mdi:registry" />
          </el-icon>
          <p>输入注册表路径并点击「查询」，或点击上方快捷标签</p>
          <p class="hint">
            仅在 Windows 目标上可用
          </p>
        </div>

        <div
          v-else-if="isLoading"
          v-loading="true"
          class="loading-state"
        />

        <div
          v-else
          class="registry-entries"
        >
          <!-- 当前路径面包屑 -->
          <div
            v-if="currentPath"
            class="breadcrumb-bar"
          >
            <el-icon size="14">
              <Icon icon="mdi:key-outline" />
            </el-icon>
            <span
              v-for="(seg, idx) in pathSegments"
              :key="idx"
              class="breadcrumb-seg"
              @click="navigateTo(pathSegments.slice(0, idx + 1).join('\\'))"
            >
              {{ seg }}
              <span
                v-if="idx < pathSegments.length - 1"
                class="sep"
              >\</span>
            </span>
            <span class="result-count">{{ entries.length }} 个键</span>
          </div>

          <!-- 键列表 -->
          <div
            v-for="(entry, idx) in entries"
            :key="idx"
            class="key-block"
          >
            <div
              class="key-header"
              @click="toggleExpand(idx)"
            >
              <el-icon size="14">
                <Icon :icon="expandedKeys.has(idx) ? 'mdi:chevron-down' : 'mdi:chevron-right'" />
              </el-icon>
              <el-icon size="14">
                <Icon icon="mdi:folder-key-outline" />
              </el-icon>
              <span
                class="key-path-text"
                @click.stop="navigateTo(entry.keyPath)"
              >
                {{ getKeyName(entry.keyPath) }}
              </span>
              <span class="value-count">{{ (entry.values || []).length }} 个值</span>
            </div>
            <div
              v-if="expandedKeys.has(idx)"
              class="values-table"
            >
              <el-table
                :data="entry.values || []"
                size="small"
                stripe
                border
                class="value-table"
              >
                <el-table-column
                  prop="name"
                  label="名称"
                  width="200"
                  show-overflow-tooltip
                />
                <el-table-column
                  prop="type"
                  label="类型"
                  width="140"
                >
                  <template #default="{ row }">
                    <el-tag
                      size="small"
                      :type="typeTagColor(row.type)"
                      effect="plain"
                    >
                      {{ row.type }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column
                  prop="data"
                  label="数据"
                  min-width="300"
                  show-overflow-tooltip
                >
                  <template #default="{ row }">
                    <span class="data-text">{{ row.data }}</span>
                  </template>
                </el-table-column>
                <el-table-column
                  label="操作"
                  width="80"
                  fixed="right"
                >
                  <template #default="{ row }">
                    <el-popconfirm
                      :title="`确认删除值 '${row.name}'？`"
                      confirm-button-text="删除"
                      cancel-button-text="取消"
                      @confirm="handleDeleteValue(entry.keyPath, row.name)"
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
            </div>
          </div>

          <div
            v-if="loaded && entries.length === 0"
            class="no-data"
          >
            未找到注册表条目
          </div>
        </div>
      </section>
    </div>

    <!-- 搜索对话框 -->
    <el-dialog
      v-model="showSearchDialog"
      title="搜索注册表"
      width="480px"
      destroy-on-close
    >
      <el-form
        label-width="80px"
        size="small"
      >
        <el-form-item label="起始路径">
          <el-input
            v-model="searchForm.keyPath"
            placeholder="HKLM (默认)"
          />
        </el-form-item>
        <el-form-item label="关键字">
          <el-input
            v-model="searchForm.pattern"
            placeholder="搜索内容"
          />
        </el-form-item>
        <el-form-item label="搜索范围">
          <el-radio-group v-model="searchForm.searchTarget">
            <el-radio value="d">
              值数据
            </el-radio>
            <el-radio value="v">
              值名称
            </el-radio>
            <el-radio value="k">
              键名
            </el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="最大条数">
          <el-input-number
            v-model="searchForm.maxResults"
            :min="1"
            :max="200"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button
          size="small"
          @click="showSearchDialog = false"
        >
          取消
        </el-button>
        <el-button
          type="primary"
          size="small"
          :loading="isLoading"
          @click="handleSearch"
        >
          搜索
        </el-button>
      </template>
    </el-dialog>

    <!-- 新建值对话框 -->
    <el-dialog
      v-model="showAddDialog"
      title="新建/修改注册表值"
      width="500px"
      destroy-on-close
    >
      <el-form
        label-width="80px"
        size="small"
      >
        <el-form-item label="键路径">
          <el-input
            v-model="addForm.keyPath"
            :placeholder="currentPath || 'HKLM\\SOFTWARE\\...'"
          />
        </el-form-item>
        <el-form-item label="值名称">
          <el-input
            v-model="addForm.valueName"
            placeholder="留空表示默认值"
          />
        </el-form-item>
        <el-form-item label="值类型">
          <el-select v-model="addForm.valueType">
            <el-option
              label="REG_SZ"
              value="REG_SZ"
            />
            <el-option
              label="REG_DWORD"
              value="REG_DWORD"
            />
            <el-option
              label="REG_QWORD"
              value="REG_QWORD"
            />
            <el-option
              label="REG_EXPAND_SZ"
              value="REG_EXPAND_SZ"
            />
            <el-option
              label="REG_MULTI_SZ"
              value="REG_MULTI_SZ"
            />
            <el-option
              label="REG_BINARY"
              value="REG_BINARY"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="值数据">
          <el-input
            v-model="addForm.valueData"
            type="textarea"
            :rows="3"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button
          size="small"
          @click="showAddDialog = false"
        >
          取消
        </el-button>
        <el-button
          type="primary"
          size="small"
          :loading="isLoading"
          @click="handleAdd"
        >
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import { Icon } from '@iconify/vue'
import {
  queryRegistryApi,
  searchRegistryApi,
  addRegistryApi,
  deleteRegistryApi,
  exportRegistryApi
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
const entries = ref([])
const keyPath = ref('')
const recursive = ref(false)
const currentPath = ref('')
const resultMode = ref('idle')
const expandedKeys = ref(new Set())
const showSearchDialog = ref(false)
const showAddDialog = ref(false)

const searchForm = reactive({
  keyPath: '',
  pattern: '',
  searchTarget: 'd',
  maxResults: 50
})

const addForm = reactive({
  keyPath: '',
  valueName: '',
  valueType: 'REG_SZ',
  valueData: ''
})

// ==================== 快捷路径 ====================

const quickPaths = [
  { label: '启动项', path: 'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run' },
  { label: '用户启动项', path: 'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run' },
  { label: '系统服务', path: 'HKLM\\SYSTEM\\CurrentControlSet\\Services' },
  { label: '已安装软件', path: 'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall' },
  { label: '环境变量', path: 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment' },
  { label: '防火墙', path: 'HKLM\\SYSTEM\\CurrentControlSet\\Services\\SharedAccess\\Parameters\\FirewallPolicy' }
]

// ==================== 计算属性 ====================

const pathSegments = computed(() => {
  if (!currentPath.value) return []
  return currentPath.value.split('\\')
})

// ==================== 方法 ====================

function navigateTo(path) {
  keyPath.value = path
  handleQuery()
}

function openAddDialog() {
  addForm.keyPath = currentPath.value || keyPath.value.trim()
  showAddDialog.value = true
}

async function handleQuery() {
  const path = keyPath.value.trim()
  if (!path) {
    showWarning('请输入注册表路径')
    return
  }

  isLoading.value = true
  loaded.value = true
  expandedKeys.value = new Set()
  try {
    const res = await queryRegistryApi({
      sessionId: props.sessionId,
      keyPath: path,
      recursive: recursive.value
    })
    const data = res.data
    entries.value = data.entries || []
    currentPath.value = path
    resultMode.value = 'query'

    // 自动展开第一个
    if (entries.value.length > 0 && entries.value.length <= 5) {
      for (let i = 0; i < entries.value.length; i++) {
        expandedKeys.value.add(i)
      }
    } else if (entries.value.length > 0) {
      expandedKeys.value.add(0)
    }

    if (entries.value.length === 0) {
      showWarning('未找到注册表条目（可能路径不存在或目标非 Windows）')
    }
  } catch (err) {
    showError('查询注册表失败: ' + (err.message || err))
  } finally {
    isLoading.value = false
  }
}

async function handleSearch() {
  if (!searchForm.pattern.trim()) {
    showWarning('请输入搜索关键字')
    return
  }

  isLoading.value = true
  loaded.value = true
  expandedKeys.value = new Set()
  try {
    const res = await searchRegistryApi({
      sessionId: props.sessionId,
      keyPath: searchForm.keyPath || 'HKLM',
      pattern: searchForm.pattern,
      searchTarget: searchForm.searchTarget,
      maxResults: searchForm.maxResults
    })
    const data = res.data
    entries.value = data.entries || []
    currentPath.value = searchForm.keyPath || 'HKLM'
    resultMode.value = 'search'

    if (entries.value.length > 0 && entries.value.length <= 10) {
      for (let i = 0; i < entries.value.length; i++) {
        expandedKeys.value.add(i)
      }
    }

    showSearchDialog.value = false
    if (entries.value.length === 0) {
      showWarning('未找到匹配的注册表条目')
    }
  } catch (err) {
    showError('搜索注册表失败: ' + (err.message || err))
  } finally {
    isLoading.value = false
  }
}

async function handleAdd() {
  const path = addForm.keyPath.trim() || currentPath.value
  if (!path) {
    showWarning('请输入键路径')
    return
  }

  isLoading.value = true
  try {
    await addRegistryApi({
      sessionId: props.sessionId,
      keyPath: path,
      valueName: addForm.valueName || null,
      valueType: addForm.valueType,
      valueData: addForm.valueData,
      force: true
    })
    showSuccess('注册表值已添加/修改')
    showAddDialog.value = false

    // 刷新刚刚修改的路径，避免仍查询旧输入框路径
    keyPath.value = path
    await handleQuery()
  } catch (err) {
    showError('添加注册表值失败: ' + (err.message || err))
  } finally {
    isLoading.value = false
  }
}

async function handleDeleteValue(regKeyPath, valueName) {
  try {
    await deleteRegistryApi({
      sessionId: props.sessionId,
      keyPath: regKeyPath,
      valueName: valueName,
      force: true
    })
    showSuccess(`值 '${valueName}' 已删除`)
    // 从列表中移除
    for (let i = 0; i < entries.value.length; i++) {
      if (entries.value[i].keyPath === regKeyPath) {
        entries.value[i].values = (entries.value[i].values || []).filter(v => v.name !== valueName)
        break
      }
    }
  } catch (err) {
    showError('删除注册表值失败: ' + (err.message || err))
  }
}

async function handleExport() {
  if (!currentPath.value) return
  if (resultMode.value !== 'query') {
    showWarning('当前为搜索结果，请先查询具体注册表路径后再导出')
    return
  }
  isLoading.value = true
  try {
    const res = await exportRegistryApi({
      sessionId: props.sessionId,
      keyPath: currentPath.value
    })
    const data = res.data
    const content = data.content || ''
    if (!content) {
      showWarning('导出内容为空')
      return
    }
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'registry-export.reg'
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    showError('导出注册表失败: ' + (err.message || err))
  } finally {
    isLoading.value = false
  }
}

function toggleExpand(idx) {
  const newSet = new Set(expandedKeys.value)
  if (newSet.has(idx)) {
    newSet.delete(idx)
  } else {
    newSet.add(idx)
  }
  expandedKeys.value = newSet
}

function getKeyName(fullPath) {
  if (!fullPath) return ''
  const parts = fullPath.split('\\')
  return parts[parts.length - 1] || fullPath
}

function typeTagColor(type) {
  if (type === 'REG_SZ' || type === 'REG_EXPAND_SZ') return ''
  if (type === 'REG_DWORD' || type === 'REG_QWORD') return 'success'
  if (type === 'REG_BINARY') return 'warning'
  if (type === 'REG_MULTI_SZ') return 'info'
  return 'info'
}
</script>

<style scoped>
.registry-workbench {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
}

.registry-shell {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* ── 工具栏 ── */
.registry-toolbar {
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
  flex: 1;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.path-input {
  flex: 1;
  max-width: 500px;
}

/* ── 快捷路径 ── */
.quick-paths {
  display: flex;
  gap: 6px;
  padding: 6px 12px;
  flex-wrap: wrap;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.quick-path-tag {
  cursor: pointer;
  transition: all 0.2s;
}

.quick-path-tag:hover {
  color: var(--el-color-primary);
  border-color: var(--el-color-primary);
}

/* ── 内容区域 ── */
.registry-content-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 8px 12px;
}

.loading-state {
  height: 200px;
}

/* ── 面包屑 ── */
.breadcrumb-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  margin-bottom: 8px;
  background: var(--el-bg-color-page);
  border-radius: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.breadcrumb-seg {
  cursor: pointer;
  color: var(--el-text-color-regular);
}

.breadcrumb-seg:hover {
  color: var(--el-color-primary);
}

.sep {
  color: var(--el-text-color-placeholder);
  margin: 0 1px;
}

.result-count {
  margin-left: auto;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

/* ── 键块 ── */
.key-block {
  margin-bottom: 4px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  overflow: hidden;
}

.key-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  cursor: pointer;
  background: var(--el-bg-color-page);
  font-size: 13px;
  transition: background 0.2s;
}

.key-header:hover {
  background: var(--el-fill-color-light);
}

.key-path-text {
  color: var(--el-color-primary);
  cursor: pointer;
  font-weight: 500;
}

.key-path-text:hover {
  text-decoration: underline;
}

.value-count {
  margin-left: auto;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}

.values-table {
  border-top: 1px solid var(--el-border-color-lighter);
}

.value-table {
  font-size: 12px;
}

.data-text {
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

.empty-state .hint {
  font-size: 11px;
  color: var(--el-text-color-disabled);
}

.no-data {
  text-align: center;
  padding: 30px;
  color: var(--el-text-color-placeholder);
  font-size: 13px;
}
</style>
