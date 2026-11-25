<template>
  <section class="artifact-library module-shell">
    <PageHeader
      title="成果库"
      :icon="iconMap.folderOpened"
    >
      <template #actions>
        <span
          class="storage-summary"
          aria-live="polite"
        >{{ summaryLabel }}</span>
        <el-button
          type="primary"
          :loading="Boolean(uploadProgress)"
          title="可多选文件，导入到「导入与其他」"
          @click="triggerUpload"
        >
          <el-icon><Icon :icon="iconMap.upload" /></el-icon>
          导入成果
        </el-button>
      </template>
    </PageHeader>
    <el-alert
      v-if="uploadReport"
      class="import-report"
      :title="uploadReportTitle"
      :type="uploadReport.failed && !uploadReport.imported ? 'error' : 'warning'"
      show-icon
      @close="uploadReport = null"
    >
      <span
        v-if="uploadReport.issues.length"
        class="import-issues"
        role="list"
      >
        <span
          v-for="(issue, index) in uploadReport.issues"
          :key="index"
          role="listitem"
        >{{ issue.name }}：{{ issue.message }}</span>
      </span>
    </el-alert>
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
        <div
          v-if="uploadProgress"
          class="import-activity"
        >
          <span
            class="upload-progress"
            role="status"
          >{{ uploadProgress.stopping ? '正在完成当前文件…' : `正在导入 ${uploadProgress.current}/${uploadProgress.total}` }}</span>
          <el-button
            v-if="uploadProgress.current < uploadProgress.total"
            link
            type="primary"
            title="当前文件处理完后停止"
            :disabled="uploadProgress.stopping"
            @click="stopQueuedImports"
          >
            停止后续导入
          </el-button>
        </div>
        <span
          class="result-count"
          aria-live="polite"
        >{{ loading ? '读取中…' : listError ? '读取失败' : `共 ${total} 项` }}</span>
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
                  :loading="downloads.has(row.path)"
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
              v-if="!loading"
              workbench
              :title="emptyState.title"
              :description="emptyState.description"
              :icon="iconMap.folderOpened"
              :action-label="emptyState.actionLabel"
              @action="listError ? fetchList() : hasFilters ? clearFilters() : triggerUpload()"
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
          :disabled="loading || Boolean(listError)"
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
      multiple
      @change="uploadFiles"
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
        :download-loading="downloads.has(detailEntry.path)"
        @preview="previewFile"
        @download="downloadFile"
        @delete="deleteFile"
      />
    </el-drawer>
    <UserSpacePreviewDialog
      v-model="previewVisible"
      :path="preview?.file.path"
      :data="preview?.data"
      :loading="previewLoading"
      :download-loading="downloads.has(preview?.file.path)"
      :error="preview?.error"
      @retry="previewFile(preview?.file)"
      @download="downloadFile(preview?.file)"
    />
  </section>
</template>

<script setup>
import PageHeader from '@/components/common/PageHeader.vue'
import { computed, onDeactivated, onMounted, onScopeDispose, ref, shallowReactive, shallowRef, watch } from 'vue'
import { ARTIFACT_CATEGORIES, ARTIFACT_SOURCE_LABELS } from '@/constants/artifacts.js'
import { icons as iconMap } from '@/utils/icons.js'
import { formatDate, formatFileSize } from '@/utils/format.js'
import { downloadBlob } from '@/utils/downloadBlob.js'
import { confirmAction, confirmDelete } from '@/utils/confirmUtils.js'
import { showError, showSuccess } from '@/utils/messageUtils.js'
import { handleError } from '@/utils/errorHandler.js'
import { userFileListApi, userFileUploadApi, userFileDownloadApi, userFilePreviewApi, userFileDeleteApi } from '@/services/api/user-space.js'
import { isCurrentSession, sessionGeneration } from '@/services/sessionLifecycle.js'
import EmptyState from '@/components/common/EmptyState.vue'
import UserSpaceDetail from './UserSpaceDetail.vue'
import UserSpacePreviewDialog from './UserSpacePreviewDialog.vue'
import { getUserSpaceEntryIconKey, getUserSpaceFileExtension, isDownloadOnlyArtifact,
  normalizeWorkspaceOverview, resolveArtifactCategoryLabel, resolveArtifactSourceLabel } from './userSpaceModel.js'

const PAGE_SIZE = 50
const IMPORT_CATEGORY = 'imports'
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
const listError = ref('')
const uploadProgress = shallowRef(null)
const uploadReport = shallowRef(null)
const uploadReportTitle = computed(() => {
  const report = uploadReport.value
  if (!report) return ''
  const counts = `成功 ${report.imported} · 跳过 ${report.skipped} · 失败 ${report.failed}`
  return report.unprocessed ? `导入已停止：${counts} · 未处理 ${report.unprocessed}` : `导入完成：${counts}`
})
const uploadInputRef = ref(null)
const overview = shallowRef(null)
const overviewOutdated = ref(false)
let overviewNeeded = true
const preview = shallowRef(null)
const downloads = shallowReactive(new Map())
let listRequest
let previewRequest
let searchTimer
let disposed = false
const previewVisible = computed({
  get: () => preview.value !== null,
  set: (visible) => {
    if (visible) return
    previewRequest?.abort()
    previewRequest = undefined
    preview.value = null
  }
})
const previewLoading = computed(() => preview.value !== null && !preview.value.data && !preview.value.error)
const summaryLabel = computed(() => {
  const data = overview.value
  if (!data) return overviewOutdated.value ? '成果统计暂不可用' : '正在读取成果统计…'
  return `${data.totalFiles} 份成果 · ${formatFileSize(data.totalBytes)}${overviewOutdated.value ? ' · 统计待刷新' : ''}`
})
const categories = computed(() => [
  { path: '', label: '全部成果', files: overview.value?.totalFiles ?? '—' },
  ...ARTIFACT_CATEGORIES.map(category => ({
    ...category,
    files: overview.value ? Number(overview.value.categories.find(item => item.path === category.path)?.files || 0) : '—'
  }))
])
const keyword = computed(() => search.value.trim())
const hasFilters = computed(() => Boolean(currentPath.value || source.value || keyword.value))
const emptyState = computed(() => {
  if (listError.value) return {
    title: '成果列表读取失败', description: listError.value, actionLabel: '重新加载'
  }
  if (source.value || keyword.value) return {
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
  clearTimeout(searchTimer)
  if (disposed) return
  listRequest?.abort()
  const request = new AbortController()
  listRequest = request
  const { signal } = request
  const params = { recursive: true, path: currentPath.value || undefined,
    search: keyword.value, source: source.value, pageSize: PAGE_SIZE }
  const includeOverview = overviewNeeded
  const loadPage = async (requestedPage, withOverview = false) => {
    const pageParams = { ...params, page: requestedPage }
    if (withOverview) pageParams.includeOverview = true
    const { data } = await userFileListApi(pageParams, { signal })
    if (!Number.isSafeInteger(data?.count) || data.count < 0 || data.page !== requestedPage || !Array.isArray(data.fileList)) {
      throw new Error('成果库列表响应格式异常')
    }
    return data
  }
  loading.value = true
  listError.value = ''
  try {
    const requestedPage = page.value
    let data = await loadPage(requestedPage, includeOverview)
    if (signal.aborted) return
    if (includeOverview) {
      overviewNeeded = false
      overviewOutdated.value = !Array.isArray(data.overview?.categories)
      if (!overviewOutdated.value) overview.value = normalizeWorkspaceOverview(data.overview)
    }
    let recoveryPage = Math.max(1, Math.ceil(data.count / PAGE_SIZE))
    if (requestedPage > recoveryPage) {
      if (data.count > 0) data = await loadPage(recoveryPage)
      if (signal.aborted) return
      // If files disappear again during recovery, page 1 is always valid.
      if (recoveryPage > 1 && (recoveryPage - 1) * PAGE_SIZE >= data.count) {
        recoveryPage = 1
        if (data.count > 0) data = await loadPage(1)
        if (signal.aborted) return
      }
      page.value = recoveryPage
    }
    total.value = data.count
    files.value = data.fileList
    if (detailVisible.value) {
      detailEntry.value = files.value.find(file => file.path === detailEntry.value?.path) || null
      if (!detailEntry.value) detailVisible.value = false
    }
  } catch (error) {
    if (signal.aborted) return
    files.value = []
    if (includeOverview && overviewNeeded) overviewOutdated.value = true
    listError.value = handleError(error, { showMessage: false, defaultMessage: '读取成果失败，请重试' })
  } finally {
    if (listRequest === request) {
      listRequest = undefined
      if (!signal.aborted) loading.value = false
    }
  }
}

function refreshWorkspace() {
  overviewNeeded = true
  return fetchList()
}

function closeFilePanels() {
  previewVisible.value = false
  detailVisible.value = false
}

function changePage(value) {
  if (page.value === value) return
  page.value = value
  closeFilePanels()
  return fetchList()
}

watch([currentPath, source, keyword], ([path, sourceId, query], [previousPath, previousSource]) => {
  clearTimeout(searchTimer)
  listRequest?.abort()
  closeFilePanels()
  loading.value = true
  listError.value = ''
  files.value = []
  total.value = 0
  page.value = 1
  if (path !== previousPath && overviewOutdated.value) overviewNeeded = true
  if (path === previousPath && sourceId === previousSource && query) {
    searchTimer = setTimeout(fetchList, 250)
  } else {
    fetchList()
  }
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
  if (uploadProgress.value || !uploadInputRef.value) return
  uploadInputRef.value.value = ''
  uploadInputRef.value.click()
}

function stopQueuedImports() {
  const progress = uploadProgress.value
  if (progress && progress.current < progress.total) {
    uploadProgress.value = { ...progress, stopping: true }
  }
}

async function uploadImport(file, isActive) {
  if (file.size === 0) throw new Error('上传文件不能为空')
  try {
    await userFileUploadApi(file, { path: IMPORT_CATEGORY })
  } catch (error) {
    if (error?.code !== 409 || !isActive()) throw error
    const overwrite = await confirmAction({
      title: '覆盖同名成果', message: `确认覆盖「${file.name}」？`, confirmButtonText: '覆盖', cancelButtonText: '跳过'
    })
    if (!overwrite || !isActive()) return false
    await userFileUploadApi(file, { path: IMPORT_CATEGORY, overwrite: true })
  }
  return true
}

async function uploadFiles(event) {
  if (disposed || uploadProgress.value) return
  const selectedFiles = Array.from(event?.target?.files ?? [])
  if (!selectedFiles.length) return

  const generation = sessionGeneration.value
  const isActive = () => !disposed && isCurrentSession(generation)
  const report = { imported: 0, skipped: 0, failed: 0, unprocessed: 0, issues: [] }
  uploadReport.value = null
  try {
    for (const [index, file] of selectedFiles.entries()) {
      if (!isActive()) return
      if (uploadProgress.value?.stopping) {
        report.unprocessed = selectedFiles.length - index
        break
      }
      uploadProgress.value = { current: index + 1, total: selectedFiles.length }
      try {
        if (await uploadImport(file, isActive)) {
          report.imported += 1
        } else {
          report.skipped += 1
          report.issues.push({ name: file.name, message: '已跳过同名文件' })
        }
      } catch (error) {
        report.failed += 1
        report.issues.push({ name: file.name, message: handleError(error, { showMessage: false, defaultMessage: '导入失败，请重试' }) })
      }
    }
    if (!isActive()) return
    if (report.issues.length || report.unprocessed) uploadReport.value = report
    else showSuccess(`已导入 ${report.imported} 份成果到「导入与其他」`)

    if (!report.imported) return
    if (currentPath.value !== IMPORT_CATEGORY || source.value || keyword.value) {
      overviewNeeded = true
      currentPath.value = IMPORT_CATEGORY
      source.value = ''
      search.value = ''
    } else {
      page.value = 1
      await refreshWorkspace()
    }
  } finally { uploadProgress.value = null }
}

async function previewFile(file) {
  if (!file?.path || disposed || (previewLoading.value && preview.value.file.path === file.path)) return
  previewRequest?.abort()
  detailVisible.value = false
  if (isDownloadOnlyArtifact(file)) {
    previewRequest = undefined
    preview.value = { file, data: { previewable: false }, error: '' }
    return
  }
  const request = new AbortController()
  previewRequest = request
  const { signal } = request
  preview.value = { file, data: null, error: '' }
  try {
    const markdown = ['md', 'markdown'].includes(getUserSpaceFileExtension(file.name))
    const { data } = await userFilePreviewApi({ path: file.path, size: markdown ? 1024 * 1024 : undefined }, { signal })
    if (signal.aborted) return
    if (data?.previewable !== false && typeof data?.content !== 'string') throw new Error('成果预览响应格式异常')
    preview.value = { file, data, error: '' }
  } catch (error) {
    if (signal.aborted) return
    preview.value = { file, data: null, error: handleError(error, { showMessage: false, defaultMessage: '读取成果预览失败' }) }
  } finally {
    if (previewRequest === request) previewRequest = undefined
  }
}

async function downloadFile(file) {
  if (!file?.path || disposed || downloads.has(file.path)) return
  const { path, name: filename } = file
  const request = new AbortController()
  const { signal } = request
  downloads.set(path, request)
  try {
    const { data } = await userFileDownloadApi({ path, filename }, { signal })
    if (!signal.aborted) downloadBlob(data, filename)
  } catch (error) {
    if (!signal.aborted) showError(`下载失败：${error?.message || '未知错误'}`)
  } finally {
    if (downloads.get(path) === request) downloads.delete(path)
  }
}

function cancelDownloads() {
  for (const request of downloads.values()) request.abort()
  downloads.clear()
}

async function deleteFile(file) {
  if (!await confirmDelete({ title: '删除成果', message: `确认删除「${file.metadata?.title || file.name}」？` })) return
  if (disposed) return
  try {
    await userFileDeleteApi({ path: file.path })
    if (detailEntry.value?.path === file.path) detailVisible.value = false
    if (preview.value?.file.path === file.path) previewVisible.value = false
    await refreshWorkspace()
  } catch (error) { showError(`删除失败：${error?.message || '未知错误'}`) }
}

watch(sessionGeneration, cancelDownloads, { flush: 'sync' })
onDeactivated(cancelDownloads)
onMounted(refreshWorkspace)
onScopeDispose(() => {
  disposed = true
  clearTimeout(searchTimer)
  listRequest?.abort()
  previewRequest?.abort()
  cancelDownloads()
})
</script>

<style scoped>
.artifact-library {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: 12px;
}
.catalog-toolbar,
.catalog-footer {
  display: flex;
  align-items: center;
  gap: 12px;
}
.storage-summary,
.upload-progress,
.result-count,
.catalog-footer {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.upload-progress {
  white-space: nowrap;
}
.import-activity {
  display: flex;
  align-items: center;
  gap: 8px;
}
.import-report {
  flex-shrink: 0;
}
.import-issues {
  display: block;
  max-height: 7rem;
  overflow: auto;
  overflow-wrap: anywhere;
}
.import-issues > span {
  display: block;
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
  padding: 10px var(--space-4);
  flex-wrap: wrap;
  flex-shrink: 0;
}
.catalog-search {
  flex: 1;
  min-width: 220px;
  max-width: 360px;
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
  .storage-summary {
    display: none;
  }
  .catalog-footer {
    flex-wrap: wrap;
  }
}
</style>
