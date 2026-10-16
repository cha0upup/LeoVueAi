<template>
  <section class="artifact-library module-shell">
    <header class="library-header">
      <div class="library-heading">
        <el-icon><Icon :icon="iconMap.folderOpened" /></el-icon>
        <div>
          <h1>成果库</h1>
          <p>保存脚本产物、分析报告与任务输出，便于查找和复用。</p>
        </div>
      </div>
      <div class="library-actions">
        <span class="storage-summary">{{ overview.totalFiles }} 份成果 · {{ formatFileSize(overview.totalBytes) }}</span>
        <el-button
          type="primary"
          :loading="uploading"
          title="外部文件导入到「导入与其他」"
          @click="triggerUpload"
        >
          <el-icon><Icon :icon="iconMap.upload" /></el-icon>
          导入成果
        </el-button>
      </div>
    </header>
    <section
      class="catalog-panel"
      aria-label="成果列表"
    >
      <nav
        class="category-nav"
        aria-label="成果分类"
      >
        <button
          v-for="category in categories"
          :key="category.path"
          type="button"
          :class="{ active: currentPath === category.path }"
          :aria-pressed="currentPath === category.path"
          @click="currentPath = category.path"
        >
          {{ category.label }}<span>{{ category.files }}</span>
        </button>
      </nav>
      <div class="catalog-toolbar">
        <el-input
          v-model="search"
          placeholder="搜索标题、文件名、主机或来源标识"
          clearable
          class="catalog-search"
        >
          <template #prefix>
            <el-icon><Icon :icon="iconMap.search" /></el-icon>
          </template>
        </el-input>
        <el-select
          v-model="source"
          placeholder="全部来源"
          aria-label="成果来源"
          class="source-filter"
        >
          <el-option
            label="全部来源"
            value=""
          />
          <el-option
            v-for="(label, key) in sourceLabels"
            :key="key"
            :label="label"
            :value="key"
          />
        </el-select>
        <el-button
          v-if="hasFilters"
          text
          @click="clearFilters"
        >
          清空筛选
        </el-button>
        <span class="result-count">{{ loading ? '读取中…' : `共 ${total} 项` }}</span>
        <el-button
          :loading="loading"
          aria-label="刷新成果库"
          title="刷新成果库"
          @click="refreshWorkspace"
        >
          <el-icon><Icon :icon="iconMap.refresh" /></el-icon>
        </el-button>
      </div>
      <div class="table-wrap">
        <el-table
          v-loading="loading"
          :data="files"
          row-key="path"
          height="100%"
          class="catalog-table"
          @row-dblclick="previewFile"
        >
          <el-table-column
            label="成果名称"
            min-width="320"
          >
            <template #default="{ row }">
              <button
                type="button"
                class="file-name-button"
                :title="row.metadata?.title || row.name"
                @click="previewFile(row)"
              >
                <span class="file-icon"><el-icon><Icon :icon="iconMap[getUserSpaceEntryIconKey(row)] || iconMap.file" /></el-icon></span>
                <span class="file-copy">
                  <strong>{{ row.metadata?.title || row.name }}</strong>
                  <small>{{ getUserSpaceFileExtension(row.name).toUpperCase() || '文件' }}<template v-if="row.metadata?.title && row.metadata.title !== row.name"> · {{ row.name }}</template></small>
                </span>
              </button>
            </template>
          </el-table-column>
          <el-table-column
            label="分类"
            width="128"
          >
            <template #default="{ row }">
              {{ resolveArtifactCategoryLabel(row.category) }}
            </template>
          </el-table-column>
          <el-table-column
            label="来源"
            width="140"
          >
            <template #default="{ row }">
              <span>{{ resolveArtifactSourceLabel(row.metadata?.sourceModule) }}</span>
              <small
                v-if="row.metadata?.hostName"
                class="source-host"
                :title="row.metadata.hostName"
              >{{ row.metadata.hostName }}</small>
            </template>
          </el-table-column>
          <el-table-column
            label="大小"
            width="96"
          >
            <template #default="{ row }">
              {{ formatFileSize(row.size) }}
            </template>
          </el-table-column>
          <el-table-column
            label="更新时间"
            width="164"
          >
            <template #default="{ row }">
              {{ formatDate(row.lastModified) }}
            </template>
          </el-table-column>
          <el-table-column
            label="操作"
            width="172"
            fixed="right"
          >
            <template #default="{ row }">
              <div class="table-actions">
                <el-button
                  link
                  type="primary"
                  @click="previewFile(row)"
                >
                  预览
                </el-button>
                <el-button
                  link
                  type="primary"
                  @click="downloadFile(row)"
                >
                  下载
                </el-button>
                <el-dropdown
                  trigger="click"
                  @command="handleRowCommand($event, row)"
                >
                  <el-button
                    text
                    :aria-label="`更多成果操作：${row.metadata?.title || row.name}`"
                  >
                    <el-icon><Icon :icon="iconMap.more" /></el-icon>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="detail">
                        查看详情
                      </el-dropdown-item>
                      <el-dropdown-item
                        command="delete"
                        divided
                        class="danger-item"
                      >
                        删除成果
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </template>
          </el-table-column>
          <template #empty>
            <EmptyState
              workbench
              :title="emptyState.title"
              :description="emptyState.description"
              :icon="iconMap.folderOpened"
              :action-label="emptyState.actionLabel"
              @action="hasFilters ? clearFilters() : triggerUpload()"
            />
          </template>
        </el-table>
      </div>
      <footer class="catalog-footer">
        <span>按更新时间倒序 · 仅展示已归档与导入的文件</span>
        <el-pagination
          size="small"
          :current-page="page"
          :page-size="PAGE_SIZE"
          :total="total"
          :pager-count="5"
          layout="prev, pager, next"
          @current-change="changePage"
        />
      </footer>
    </section>
    <input
      ref="uploadInputRef"
      type="file"
      hidden
      @change="uploadFile"
    >
    <el-drawer
      v-model="detailVisible"
      title="成果详情"
      size="min(520px, 100vw)"
      append-to-body
      destroy-on-close
    >
      <UserSpaceDetail
        v-if="detailEntry"
        :entry="detailEntry"
        @preview="previewFile"
        @download="downloadFile"
        @delete="deleteFile"
      />
    </el-drawer>
    <UserSpacePreviewDialog
      v-model="previewVisible"
      :data="previewData"
    />
  </section>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { ARTIFACT_CATEGORIES, ARTIFACT_SOURCE_LABELS } from '@/constants/artifacts.js'
import { icons as iconMap } from '@/utils/icons.js'
import { formatDate, formatFileSize } from '@/utils/format.js'
import { downloadBlob } from '@/utils/downloadBlob.js'
import { confirmAction, confirmDelete } from '@/utils/confirmUtils.js'
import { showError, showSuccess } from '@/utils/messageUtils.js'
import { userFileListApi, userWorkspaceOverviewApi, userFileUploadApi, userFileDownloadApi, userFilePreviewApi, userFileDeleteApi } from '@/services/api/user-space.js'
import EmptyState from '@/components/common/EmptyState.vue'
import UserSpaceDetail from './UserSpaceDetail.vue'
import UserSpacePreviewDialog from './UserSpacePreviewDialog.vue'
import { getUserSpaceEntryIconKey, getUserSpaceFileExtension, normalizeWorkspaceOverview, resolveArtifactCategoryLabel, resolveArtifactSourceLabel } from './userSpaceModel.js'

const PAGE_SIZE = 50
const sourceLabels = ARTIFACT_SOURCE_LABELS
const currentPath = ref('')
const source = ref('')
const search = ref('')
const page = ref(1)
const total = ref(0)
const files = ref([])
const detailEntry = ref(null)
const detailVisible = ref(false)
const loading = ref(false)
const uploading = ref(false)
const uploadInputRef = ref(null)
const overview = ref(normalizeWorkspaceOverview())
const previewVisible = ref(false)
const previewData = ref({})
let listSequence = 0
let previewSequence = 0
let overviewSequence = 0
let searchTimer
const categories = computed(() => [
  { path: '', label: '全部成果', files: overview.value.totalFiles },
  ...ARTIFACT_CATEGORIES.map(category => ({
    ...category,
    files: Number(overview.value.categories.find(item => item.path === category.path)?.files || 0)
  }))
])
const hasFilters = computed(() => Boolean(currentPath.value || source.value || search.value.trim()))
const emptyState = computed(() => {
  if (source.value || search.value.trim()) return {
    title: '没有匹配的成果', description: '尝试调整分类、来源或搜索关键词。', actionLabel: '清空筛选'
  }
  if (currentPath.value) return {
    title: currentPath.value === 'imports' ? '暂无导入文件' : `暂无${resolveArtifactCategoryLabel(currentPath.value)}`,
    description: {
      'script-builds': '在脚本构建中保存产物后，会自动收录到这里。',
      'ai-reports': '在平台 AI 或节点 AI 对话中归档的分析报告会收录到这里。',
      'task-results': '在任务详情中将输出文件归档后，会收录到这里，原始文件保留。',
      imports: '通过「导入成果」收录已有文件，后续可统一检索和下载。'
    }[currentPath.value],
    actionLabel: '查看全部成果'
  }
  return {
    title: '还没有归档成果',
    description: '脚本构建、AI 对话和任务详情中的归档结果会显示在这里，也可导入已有文件。',
    actionLabel: '导入成果'
  }
})

async function fetchList() {
  const sequence = ++listSequence
  loading.value = true
  try {
    const response = await userFileListApi({ recursive: true, path: currentPath.value || undefined,
      search: search.value, source: source.value, page: page.value, pageSize: PAGE_SIZE })
    if (sequence !== listSequence) return
    const data = response.data || {}
    if (!Number.isInteger(data.page)) throw new Error('成果库接口尚未加载，请重启后端后刷新')
    total.value = Number(data.count || 0)
    const lastPage = Math.max(1, Math.ceil(total.value / PAGE_SIZE))
    if (page.value > lastPage) {
      page.value = lastPage
      return fetchList()
    }
    files.value = Array.isArray(data.fileList) ? data.fileList : []
    if (detailVisible.value) {
      detailEntry.value = files.value.find(file => file.path === detailEntry.value?.path) || null
      if (!detailEntry.value) detailVisible.value = false
    }
  } catch (error) {
    if (sequence === listSequence) showError(`读取成果失败：${error?.message || '未知错误'}`)
  } finally {
    if (sequence === listSequence) loading.value = false
  }
}

async function fetchOverview() {
  const sequence = ++overviewSequence
  try {
    const response = await userWorkspaceOverviewApi()
    if (sequence === overviewSequence && Array.isArray(response.data?.categories)) overview.value = normalizeWorkspaceOverview(response.data)
  } catch { /* Keep the previous counters; the artifact list remains usable. */ }
}

async function refreshWorkspace() {
  clearTimeout(searchTimer)
  await Promise.all([fetchList(), fetchOverview()])
}

function changePage(value) {
  if (page.value === value) return
  page.value = value
  previewVisible.value = false
  detailVisible.value = false
  ++previewSequence
  fetchList()
}

watch([currentPath, source, search], () => {
  ++listSequence
  ++previewSequence
  previewVisible.value = false
  detailVisible.value = false
  loading.value = true
  files.value = []
  total.value = 0
  page.value = 1
  clearTimeout(searchTimer)
  searchTimer = setTimeout(fetchList, 250)
})

function clearFilters() {
  currentPath.value = ''
  source.value = ''
  search.value = ''
}

function handleRowCommand(command, file) {
  if (command === 'delete') return deleteFile(file)
  detailEntry.value = file
  detailVisible.value = true
}

function triggerUpload() {
  if (!uploadInputRef.value) return
  uploadInputRef.value.value = ''
  uploadInputRef.value.click()
}

async function uploadFile(event) {
  const file = event?.target?.files?.[0]
  if (!file || uploading.value) return
  const path = 'imports'
  uploading.value = true
  try {
    try { await userFileUploadApi(file, { path }) }
    catch (error) {
      if (error?.code !== 409) throw error
      if (!await confirmAction({ title: '覆盖同名成果', message: `确认覆盖「${file.name}」？`, type: 'warning' })) return
      await userFileUploadApi(file, { path, overwrite: true })
    }
    showSuccess('已导入到「导入与其他」')
    if (currentPath.value !== path || source.value || search.value) {
      currentPath.value = path
      source.value = ''
      search.value = ''
      await fetchOverview()
    } else {
      page.value = 1
      await refreshWorkspace()
    }
  } catch (error) { showError(`导入失败：${error?.message || '未知错误'}`) }
  finally { uploading.value = false }
}

async function previewFile(file) {
  detailVisible.value = false
  const sequence = ++previewSequence
  try {
    const markdown = ['md', 'markdown'].includes(getUserSpaceFileExtension(file.name))
    const response = await userFilePreviewApi({ path: file.path, size: markdown ? 1024 * 1024 : undefined })
    if (sequence !== previewSequence) return
    previewData.value = response.data
    previewVisible.value = true
  } catch (error) {
    if (sequence === previewSequence) showError(`预览失败：${error?.message || '未知错误'}`)
  }
}

async function downloadFile(file) {
  try {
    const response = await userFileDownloadApi({ path: file.path, filename: file.name })
    downloadBlob(response.data, file.name)
  } catch (error) { showError(`下载失败：${error?.message || '未知错误'}`) }
}

async function deleteFile(file) {
  if (!await confirmDelete({ title: '删除成果', message: `确认删除「${file.metadata?.title || file.name}」？` })) return
  try {
    await userFileDeleteApi({ path: file.path })
    if (detailEntry.value?.path === file.path) detailVisible.value = false
    previewVisible.value = false
    ++previewSequence
    await refreshWorkspace()
  } catch (error) { showError(`删除失败：${error?.message || '未知错误'}`) }
}

onMounted(refreshWorkspace)
onUnmounted(() => { clearTimeout(searchTimer); ++listSequence; ++overviewSequence; ++previewSequence })
</script>

<style scoped>
@import '@/styles/workbench-toolbar-shared.css';

.artifact-library {
  --workspace-border-soft: var(--app-divider-color);
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: 12px;
}
.library-header,
.library-heading,
.library-actions,
.catalog-toolbar,
.catalog-footer {
  display: flex;
  align-items: center;
  gap: 12px;
}
.library-header {
  justify-content: space-between;
  padding: 4px 2px;
  flex-shrink: 0;
}
.library-heading > .el-icon {
  font-size: 22px;
  color: var(--el-color-primary);
}
.library-heading h1 {
  margin: 0;
  font-size: var(--font-size-page-title);
}
.library-heading p {
  margin: 5px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.storage-summary,
.result-count,
.catalog-footer {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.catalog-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--app-surface-border-strong);
  border-radius: var(--radius-container);
  background: var(--app-container-background);
}
.category-nav {
  display: flex;
  gap: 24px;
  padding: 0 16px;
  overflow-x: auto;
  border-bottom: 1px solid var(--app-divider-color);
  flex-shrink: 0;
}
.category-nav button {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 44px;
  padding: 0 2px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--el-text-color-secondary);
  font: inherit;
  font-size: 13px;
  white-space: nowrap;
  cursor: pointer;
}
.category-nav button.active {
  color: var(--el-color-primary);
  border-bottom-color: var(--el-color-primary);
  font-weight: 600;
}
.category-nav button:focus-visible,
.file-name-button:focus-visible {
  outline: var(--focus-outline);
  outline-offset: -2px;
}
.category-nav button span {
  font-size: 11px;
  opacity: 0.8;
}
.catalog-toolbar {
  padding: 12px 16px;
  flex-wrap: wrap;
  flex-shrink: 0;
}
.catalog-search {
  flex: 1;
  min-width: 220px;
  max-width: 420px;
}
.source-filter {
  width: 150px;
}
.result-count {
  margin-left: auto;
  white-space: nowrap;
}
.table-wrap {
  flex: 1;
  min-height: 0;
  padding: 0 16px;
}
.catalog-table {
  --el-table-header-bg-color: var(--app-control-background-soft);
  font-size: 12px;
}
.catalog-table :deep(th.el-table__cell) {
  color: var(--el-text-color-secondary);
  font-weight: 600;
}
.catalog-table :deep(td.el-table__cell) {
  padding: 12px 0;
}
.file-name-button {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--el-text-color-primary);
  text-align: left;
  cursor: pointer;
}
.file-name-button:hover strong {
  color: var(--el-color-primary);
}
.file-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 34px;
  border-radius: var(--radius-control);
  flex-shrink: 0;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-size: 18px;
}
.file-copy {
  min-width: 0;
}
.file-copy strong,
.file-copy small,
.source-host {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-copy strong {
  font-size: 13px;
  font-weight: 600;
}
.file-copy small,
.source-host {
  color: var(--el-text-color-secondary);
  font-size: 11px;
  margin-top: 3px;
}
.table-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.table-actions .el-button {
  margin: 0;
  font-size: 12px;
}
.table-actions :deep(.el-button.is-link) {
  height: auto;
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
}
.catalog-footer {
  justify-content: space-between;
  flex-shrink: 0;
  padding: 10px 16px;
  border-top: 1px solid var(--app-divider-color);
}
@media (max-width: 900px) {
  .library-header {
    align-items: flex-start;
  }
  .library-actions {
    flex-shrink: 0;
  }
  .storage-summary,
  .library-heading p {
    display: none;
  }
  .catalog-footer {
    flex-wrap: wrap;
  }
}
</style>
