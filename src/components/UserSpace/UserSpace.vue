<template>
  <ManagerLayout
    title="成果库"
    :icon="iconMap.folderOpened"
    module-class="user-space-manager"
    hide-toolbar
    :initial-list-width="278"
    :list-min="240"
    :list-max="360"
  >
    <template #list>
      <div class="artifact-nav">
        <header class="artifact-nav__header">
          <div>
            <span>ARTIFACT INDEX</span>
            <h2>成果导航</h2>
          </div>
          <el-tooltip
            content="刷新成果库"
            placement="top"
          >
            <button
              class="u-icon-btn"
              type="button"
              aria-label="刷新成果库"
              :disabled="loading"
              @click="refreshWorkspace"
            >
              <el-icon :class="{ 'u-spin': loading }">
                <Icon :icon="iconMap.refresh" />
              </el-icon>
            </button>
          </el-tooltip>
        </header>

        <nav
          class="artifact-nav__primary"
          aria-label="成果库导航"
        >
          <button
            type="button"
            :class="{ active: isWorkspaceHome }"
            @click="openWorkspaceHome"
          >
            <el-icon><Icon :icon="iconMap.homeFilled" /></el-icon>
            <span><strong>成果概览</strong><small>关键数据与最近成果</small></span>
          </button>
          <button
            type="button"
            :class="{ active: !isWorkspaceHome && !currentPath }"
            @click="openFileBrowser"
          >
            <el-icon><Icon :icon="iconMap.folderOpened" /></el-icon>
            <span><strong>全部成果</strong><small>{{ workspaceSummaryText }}</small></span>
          </button>
        </nav>

        <section class="artifact-nav__categories">
          <div class="artifact-nav__label">
            <span>ARTIFACT TYPES</span><strong>成果类型</strong>
          </div>
          <button
            v-for="category in artifactCategories"
            :key="category.path"
            type="button"
            :class="{ active: currentPath === category.path }"
            @click="goPath(category.path)"
          >
            <span class="category-icon"><el-icon><Icon :icon="category.icon" /></el-icon></span>
            <span><strong>{{ category.label }}</strong><small>{{ category.files }} 项 · {{ formatFileSize(category.bytes) }}</small></span>
            <el-icon class="category-arrow">
              <Icon :icon="iconMap.arrowRight" />
            </el-icon>
          </button>
        </section>
      </div>
    </template>

    <template #detail>
      <section class="artifact-detail">
        <header class="artifact-detail__header">
          <div>
            <span>{{ isWorkspaceHome ? 'ARTIFACT LIBRARY' : 'ARTIFACT BROWSER' }}</span>
            <div>
              <h1>{{ isWorkspaceHome ? '成果库' : currentPathLabel }}</h1>
              <small>{{
                isWorkspaceHome ? workspaceSummaryText : `${filteredCount} / ${totalCount} 项`
              }}</small>
            </div>
          </div>
          <div class="artifact-detail__actions">
            <el-button @click="openCreateFileDialog">
              <el-icon><Icon :icon="iconMap.documentAdd" /></el-icon>新建文档
            </el-button>
            <el-button @click="openCreateDirDialog">
              <el-icon><Icon :icon="iconMap.folderAdd" /></el-icon>新建目录
            </el-button>
            <el-button
              type="primary"
              :loading="uploading"
              @click="triggerUpload"
            >
              <el-icon><Icon :icon="iconMap.upload" /></el-icon>导入成果
            </el-button>
          </div>
        </header>

        <div
          v-if="isWorkspaceHome"
          class="artifact-overview"
        >
          <section class="artifact-hero">
            <div>
              <span>KNOWLEDGE TO DELIVERY · 从分析到交付</span>
              <h2>让每次分析与执行，都沉淀为可复用成果</h2>
              <p>
                脚本构建、AI
                分析报告与任务输出统一归档，减少重复查找，让结果可以继续预览、下载和流转。
              </p>
            </div>
            <el-button
              type="primary"
              @click="openFileBrowser"
            >
              浏览全部成果<el-icon><Icon :icon="iconMap.arrowRight" /></el-icon>
            </el-button>
          </section>

          <div class="artifact-metrics">
            <article
              v-for="stat in workspaceStats.slice(0, 3)"
              :key="stat.label"
            >
              <span class="metric-icon"><el-icon><Icon :icon="stat.icon" /></el-icon></span>
              <span><small>{{ stat.label }}</small><strong>{{ stat.value }}</strong></span>
            </article>
          </div>

          <div class="artifact-overview__grid">
            <section class="overview-panel">
              <header>
                <div>
                  <span>RECENT ARTIFACTS</span>
                  <h3>最近成果</h3>
                </div>
                <el-button
                  text
                  @click="openFileBrowser"
                >
                  查看全部
                </el-button>
              </header>
              <div
                v-if="recentFiles.length"
                class="recent-artifact-list"
              >
                <button
                  v-for="file in recentFiles"
                  :key="file.path"
                  type="button"
                  @click="selectRecentFile(file)"
                >
                  <span class="recent-icon"><el-icon><Icon :icon="iconMap.document" /></el-icon></span>
                  <span><strong>{{ file.name }}</strong><small>{{ resolveArtifactCategoryLabel(file.parentPath) }} ·
                    {{ formatTimestamp(file.lastModified) }}</small></span>
                  <el-icon><Icon :icon="iconMap.arrowRight" /></el-icon>
                </button>
              </div>
              <div
                v-else
                class="artifact-empty"
              >
                <el-icon><Icon :icon="iconMap.documentAdd" /></el-icon><strong>还没有成果</strong><span>从脚本构建、AI 分析或任务中心归档第一份成果。</span>
              </div>
            </section>

            <section class="overview-panel">
              <header>
                <div>
                  <span>DELIVERY STREAMS</span>
                  <h3>成果来源</h3>
                </div>
              </header>
              <div class="artifact-streams">
                <button
                  v-for="category in artifactCategories"
                  :key="category.path"
                  type="button"
                  @click="goPath(category.path)"
                >
                  <span class="stream-icon"><el-icon><Icon :icon="category.icon" /></el-icon></span>
                  <span><strong>{{ category.label }}</strong><small>{{ category.description }}</small></span>
                  <em>{{ category.files }}</em>
                </button>
              </div>
            </section>
          </div>
        </div>

        <div
          v-else
          class="artifact-browser-workbench"
        >
          <UserSpaceFileTree
            ref="fileTreeRef"
            :loading="loading"
            :current-path="currentPath"
            :file-list="fileList"
            :search-keyword="searchKeyword"
            :selected-entry="selectedEntry"
            @fetch-list="refreshWorkspace"
            @go-root="goRoot"
            @go-path="goPath"
            @trigger-upload="triggerUpload"
            @handle-upload-change="handleUploadChange"
            @select-entry="selectEntry"
            @enter-directory="enterDirectory"
            @preview-file="previewFile"
            @search-keyword-change="(keyword) => (searchKeyword = keyword)"
            @clear-search="() => (searchKeyword = '')"
          />
          <UserSpaceTable
            :selected-entry="selectedEntry"
            @enter-directory="enterDirectory"
            @preview-file="previewFile"
            @download-file="downloadFile"
            @delete-entry="deleteEntry"
          />
        </div>
      </section>
    </template>

    <UserSpaceCreateDialog
      v-model="createDirVisible"
      type="directory"
      :current-path-label="currentPathLabel"
      :loading="creatingDir"
      @submit="submitCreateDir"
    />
    <UserSpaceCreateDialog
      v-model="createFileVisible"
      type="file"
      :current-path-label="currentPathLabel"
      :loading="creatingFile"
      @submit="submitCreateFile"
    />
    <UserSpacePreviewDialog
      v-model="previewVisible"
      :data="previewData"
    />
  </ManagerLayout>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { confirmAction, confirmDelete } from '@/utils/confirmUtils.js'
import { icons } from '@/utils/icons.js'
import {
  userFileListApi,
  userWorkspaceOverviewApi,
  userFileUploadApi,
  userFileDownloadApi,
  userFileCreateFileApi,
  userFileCreateDirApi,
  userFilePreviewApi,
  userFileDeleteApi
} from '@/services/api.js'
import ManagerLayout from '@/components/common/ManagerLayout.vue'
import UserSpaceCreateDialog from './UserSpaceCreateDialog.vue'
import UserSpaceFileTree from './UserSpaceFileTree.vue'
import UserSpacePreviewDialog from './UserSpacePreviewDialog.vue'
import UserSpaceTable from './UserSpaceTable.vue'
import { formatDate, formatFileSize } from '@/utils/format.js'
import { showError, showSuccess, showWarning } from '@/utils/messageUtils.js'
import {
  filterUserSpaceEntries,
  isArtifactCategoryPath,
  joinUserSpacePath,
  normalizeWorkspaceOverview,
  resolveArtifactCategoryLabel
} from './userSpaceModel.js'

const iconMap = icons

const loading = ref(false)
const workspaceMode = ref('home')
const currentPath = ref('')
const fileList = ref([])
const selectedEntry = ref(null)
const searchKeyword = ref('')
const fileTreeRef = ref(null)
const workspaceOverview = ref(normalizeWorkspaceOverview())

const createDirVisible = ref(false)
const createFileVisible = ref(false)
const creatingDir = ref(false)
const creatingFile = ref(false)
const uploading = ref(false)

const previewVisible = ref(false)
const previewData = ref({
  path: '',
  size: 0,
  previewSize: 0,
  truncated: false,
  content: ''
})
let listRequestSequence = 0
let overviewRequestSequence = 0
let previewRequestSequence = 0

const filteredFileList = computed(() => filterUserSpaceEntries(fileList.value, searchKeyword.value))

const totalCount = computed(() => fileList.value.length)
const filteredCount = computed(() => filteredFileList.value.length)
const directoryCount = computed(() => fileList.value.filter((item) => item.isDirectory).length)
const fileCount = computed(() => fileList.value.filter((item) => !item.isDirectory).length)
const currentPathLabel = computed(() => {
  return resolveArtifactCategoryLabel(currentPath.value) || '成果库根目录'
})
const isWorkspaceHome = computed(() => workspaceMode.value === 'home' && !currentPath.value)
const workspaceSummaryText = computed(() => {
  const files = Number(workspaceOverview.value.totalFiles || 0)
  const directories = Number(workspaceOverview.value.totalDirectories || 0)
  return `${files} 个文件 · ${directories} 个文件夹`
})
const recentFiles = computed(() => {
  const files = Array.isArray(workspaceOverview.value.recentFiles)
    ? workspaceOverview.value.recentFiles
    : []
  return files.slice(0, 5)
})
const topDirectories = computed(() => {
  const dirs = Array.isArray(workspaceOverview.value.topDirectories)
    ? workspaceOverview.value.topDirectories
    : []
  return dirs.slice(0, 5)
})
const artifactCategories = computed(() => {
  const meta = [
    {
      path: 'script-builds',
      label: '脚本构建',
      description: '可复用的构建与交付脚本',
      icon: iconMap.codeFile
    },
    {
      path: 'ai-reports',
      label: 'AI 分析报告',
      description: '平台与节点分析结论',
      icon: iconMap.chatAi
    },
    {
      path: 'task-results',
      label: '任务输出',
      description: '执行结果、错误与流转记录',
      icon: iconMap.task
    }
  ]
  const directoryMap = new Map(topDirectories.value.map((dir) => [dir.path || dir.name, dir]))
  return meta.map((item) => {
    const directory = directoryMap.get(item.path) || {}
    return {
      ...item,
      files: Number(directory.files || 0),
      bytes: Number(directory.bytes || 0)
    }
  })
})
const workspaceStats = computed(() => {
  const stats = [
    {
      label: '文件',
      value: Number(workspaceOverview.value.totalFiles || fileCount.value),
      icon: iconMap.files
    },
    {
      label: '目录',
      value: Number(workspaceOverview.value.totalDirectories || directoryCount.value),
      icon: iconMap.folder
    },
    {
      label: '占用',
      value: formatFileSize(workspaceOverview.value.totalBytes || 0),
      icon: iconMap.hardDrive
    },
    {
      label: '成果库根目录项',
      value: Number(workspaceOverview.value.rootItems || totalCount.value),
      icon: iconMap.grid
    }
  ]
  const maxUploadBytes = Number(workspaceOverview.value.maxUploadBytes || 0)
  if (maxUploadBytes > 0) {
    stats.push({
      label: '单文件上限',
      value: formatFileSize(maxUploadBytes),
      icon: iconMap.upload
    })
  }
  return stats
})

const formatTimestamp = (value) => formatDate(value)

const selectEntry = (row) => {
  selectedEntry.value = row
}

const keepSelection = () => {
  if (!fileList.value.length) {
    selectedEntry.value = null
    return
  }
  const prevPath = selectedEntry.value?.path
  if (prevPath) {
    const found = fileList.value.find((item) => item.path === prevPath)
    if (found) {
      selectedEntry.value = found
      return
    }
  }
  selectedEntry.value = filteredFileList.value[0] || fileList.value[0] || null
}

const fetchList = async () => {
  const requestId = ++listRequestSequence
  const requestedPath = currentPath.value
  loading.value = true
  try {
    const res = await userFileListApi({ path: requestedPath || undefined })
    if (requestId !== listRequestSequence || currentPath.value !== requestedPath) return
    const data = res?.data || {}
    fileList.value = Array.isArray(data.fileList) ? data.fileList : []
    currentPath.value = String(data.path || requestedPath || '')
    keepSelection()
  } catch (error) {
    if (requestId !== listRequestSequence || currentPath.value !== requestedPath) return
    if (isArtifactCategoryPath(requestedPath)) {
      fileList.value = []
      selectedEntry.value = null
      return
    }
    showError(`获取目录失败: ${error?.message || '未知错误'}`)
  } finally {
    if (requestId === listRequestSequence) loading.value = false
  }
}

const fetchOverview = async () => {
  const requestId = ++overviewRequestSequence
  try {
    const res = await userWorkspaceOverviewApi()
    if (requestId !== overviewRequestSequence) return
    workspaceOverview.value = normalizeWorkspaceOverview(res?.data)
  } catch {
    // 概览是辅助信息，保留上一次成功结果，文件浏览仍可继续使用。
  }
}

const refreshWorkspace = async () => {
  await Promise.all([fetchList(), fetchOverview()])
}

const leaveCurrentPreviewContext = () => {
  previewRequestSequence += 1
  previewVisible.value = false
}

const goRoot = async () => {
  leaveCurrentPreviewContext()
  currentPath.value = ''
  workspaceMode.value = 'files'
  await fetchList()
}

const goPath = async (path) => {
  leaveCurrentPreviewContext()
  currentPath.value = path || ''
  workspaceMode.value = 'files'
  await fetchList()
}

const enterDirectory = async (row) => {
  leaveCurrentPreviewContext()
  currentPath.value = row.path || joinUserSpacePath(currentPath.value, row.name)
  workspaceMode.value = 'files'
  await fetchList()
}

const selectRecentFile = async (file) => {
  leaveCurrentPreviewContext()
  workspaceMode.value = 'files'
  const parentPath = file.parentPath || ''
  if (parentPath !== currentPath.value) {
    currentPath.value = parentPath
    await fetchList()
    if (currentPath.value !== parentPath) return
  }
  const found = fileList.value.find((item) => item.path === file.path)
  selectedEntry.value = found || file
}

const openWorkspaceHome = async () => {
  leaveCurrentPreviewContext()
  currentPath.value = ''
  workspaceMode.value = 'home'
  await refreshWorkspace()
}

const openFileBrowser = async () => {
  leaveCurrentPreviewContext()
  currentPath.value = ''
  workspaceMode.value = 'files'
  await fetchList()
}

const triggerUpload = async () => {
  if (uploading.value) return
  if (isWorkspaceHome.value) {
    workspaceMode.value = 'files'
    await nextTick()
  }
  fileTreeRef.value?.triggerUpload()
}

const handleUploadChange = async (event) => {
  const file = event?.target?.files?.[0]
  if (!file || uploading.value) return
  const uploadPath = currentPath.value || undefined
  uploading.value = true
  try {
    await userFileUploadApi(file, { path: uploadPath })
    showSuccess('上传成功')
    await refreshWorkspace()
  } catch (error) {
    if (error?.code === 409) {
      const confirmed = await confirmAction({
        title: '覆盖同名文件',
        message: `「${file.name}」已存在，覆盖后无法恢复原文件，是否继续？`,
        confirmButtonText: '覆盖上传',
        type: 'warning'
      })
      if (!confirmed) return
      try {
        await userFileUploadApi(file, {
          path: uploadPath,
          overwrite: true
        })
        showSuccess('已覆盖上传')
        await refreshWorkspace()
        return
      } catch (overwriteError) {
        showError(`上传失败: ${overwriteError?.message || '未知错误'}`)
        return
      }
    }
    showError(`上传失败: ${error?.message || '未知错误'}`)
  } finally {
    uploading.value = false
  }
}

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  try {
    a.href = url
    a.download = filename || 'download-file'
    document.body.appendChild(a)
    a.click()
  } finally {
    a.remove()
    URL.revokeObjectURL(url)
  }
}

const downloadFile = async (row) => {
  try {
    const res = await userFileDownloadApi({ path: row.path, filename: row.name })
    downloadBlob(res.data, row.name)
    showSuccess('下载已开始')
  } catch (error) {
    showError(`下载失败: ${error?.message || '未知错误'}`)
  }
}

const previewFile = async (row) => {
  const requestId = ++previewRequestSequence
  try {
    const res = await userFilePreviewApi({ path: row.path })
    if (requestId !== previewRequestSequence) return
    const data = res?.data || {}
    previewData.value = {
      path: data.path || row.path,
      size: Number(data.size || 0),
      previewSize: Number(data.previewSize || 0),
      truncated: Boolean(data.truncated),
      content: String(data.content || '')
    }
    previewVisible.value = true
  } catch (error) {
    if (requestId !== previewRequestSequence) return
    showError(`预览失败: ${error?.message || '未知错误'}`)
  }
}

const deleteEntry = async (row) => {
  try {
    let recursive = false
    if (row.isDirectory) {
      const confirmed = await confirmDelete({
        title: '删除目录',
        message: `目录 "${row.name}" 删除需要递归删除，确认继续？`
      })
      if (!confirmed) return
      recursive = true
    } else {
      const confirmed = await confirmDelete({
        title: '删除文件',
        message: `确认删除文件 "${row.name}"？`
      })
      if (!confirmed) return
    }

    await userFileDeleteApi({ path: row.path, recursive })
    showSuccess('删除成功')
    await refreshWorkspace()
  } catch (error) {
    showError(`删除失败: ${error?.message || '未知错误'}`)
  }
}

const openCreateDirDialog = () => {
  createDirVisible.value = true
}

const openCreateFileDialog = () => {
  createFileVisible.value = true
}

const submitCreateDir = async (form) => {
  if (creatingDir.value) return
  const name = String(form?.name || '').trim()
  if (!name) {
    showWarning('目录名不能为空')
    return
  }
  const path = joinUserSpacePath(currentPath.value, name)
  creatingDir.value = true
  try {
    await userFileCreateDirApi({ path })
    showSuccess('目录创建成功')
    createDirVisible.value = false
    await refreshWorkspace()
  } catch (error) {
    showError(`创建目录失败: ${error?.message || '未知错误'}`)
  } finally {
    creatingDir.value = false
  }
}

const submitCreateFile = async (form) => {
  if (creatingFile.value) return
  const name = String(form?.name || '').trim()
  if (!name) {
    showWarning('文件名不能为空')
    return
  }
  const path = joinUserSpacePath(currentPath.value, name)
  const content = String(form?.content || '')
  creatingFile.value = true
  try {
    await userFileCreateFileApi({
      path,
      content
    })
    showSuccess('文件创建成功')
    createFileVisible.value = false
    await refreshWorkspace()
  } catch (error) {
    if (error?.code === 409) {
      const confirmed = await confirmAction({
        title: '覆盖同名文件',
        message: `「${name}」已存在，覆盖后无法恢复原内容，是否继续？`,
        confirmButtonText: '覆盖创建',
        type: 'warning'
      })
      if (!confirmed) return
      try {
        await userFileCreateFileApi({
          path,
          content,
          overwrite: true
        })
        showSuccess('已覆盖同名文件')
        createFileVisible.value = false
        await refreshWorkspace()
        return
      } catch (overwriteError) {
        showError(`创建文件失败: ${overwriteError?.message || '未知错误'}`)
        return
      }
    }
    showError(`创建文件失败: ${error?.message || '未知错误'}`)
  } finally {
    creatingFile.value = false
  }
}

onMounted(() => {
  refreshWorkspace()
})
</script>

<style scoped>
/* Artifact Library 2.0 — 与任务中心、主机管理共用左右工作台节奏。 */
.user-space-manager {
  width: 100%;
  min-height: 0;
  --workspace-surface-raised: color-mix(
    in srgb,
    var(--app-control-background-soft) 88%,
    var(--el-bg-color-overlay)
  );
  --workspace-surface-muted: color-mix(
    in srgb,
    var(--app-control-background) 94%,
    var(--el-bg-color-overlay)
  );
  --workspace-border-soft: color-mix(in srgb, var(--el-border-color) 42%, transparent);
  --workbench-surface-muted: var(--workspace-surface-muted);
  --workbench-border-soft: var(--workspace-border-soft);
}

.artifact-nav,
.artifact-detail {
  min-width: 0;
  min-height: 0;
  height: 100%;
}

.artifact-nav {
  display: flex;
  flex-direction: column;
  padding: 14px 12px;
  overflow: auto;
}

.artifact-nav__header,
.artifact-detail__header,
.overview-panel > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.artifact-nav__header {
  padding: 0 4px 13px;
  border-bottom: 1px solid var(--workspace-border-soft);
}

.artifact-nav__header span,
.artifact-nav__label > span,
.artifact-detail__header > div:first-child > span,
.artifact-hero > div > span,
.overview-panel > header span {
  display: block;
  color: var(--el-text-color-placeholder);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.09em;
  line-height: 1.2;
}

.artifact-nav__header h2,
.artifact-detail__header h1,
.overview-panel h3 {
  margin: 3px 0 0;
  color: var(--el-text-color-primary);
}

.artifact-nav__header h2 {
  font-size: 15px;
}

.artifact-nav__primary,
.artifact-nav__categories,
.recent-artifact-list,
.artifact-streams {
  display: flex;
  flex-direction: column;
}

.artifact-nav__primary {
  gap: 5px;
  padding: 12px 0;
  border-bottom: 1px solid var(--workspace-border-soft);
}

.artifact-nav__primary button,
.artifact-nav__categories button,
.recent-artifact-list button,
.artifact-streams button {
  border: 0;
  color: var(--el-text-color-primary);
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.artifact-nav__primary button {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr);
  align-items: center;
  gap: 9px;
  min-height: 52px;
  padding: 8px 10px;
  border-radius: var(--radius-control);
}

.artifact-nav__primary button:hover,
.artifact-nav__primary button.active,
.artifact-nav__categories button:hover,
.artifact-nav__categories button.active {
  background: color-mix(in srgb, var(--el-color-primary) 8%, transparent);
}

.artifact-nav__primary button.active,
.artifact-nav__categories button.active {
  color: var(--el-color-primary);
  box-shadow: inset 3px 0 0 var(--el-color-primary);
}

.artifact-nav button strong,
.artifact-nav button small,
.recent-artifact-list strong,
.recent-artifact-list small,
.artifact-streams strong,
.artifact-streams small {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.artifact-nav button strong {
  font-size: 12.5px;
}
.artifact-nav button small {
  margin-top: 3px;
  color: var(--el-text-color-secondary);
  font-size: 10.5px;
}

.artifact-nav__categories {
  gap: 5px;
  padding-top: 15px;
}
.artifact-nav__label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 6px 6px;
}
.artifact-nav__label > strong {
  font-size: 12px;
}
.artifact-nav__categories button {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) 16px;
  align-items: center;
  gap: 9px;
  min-height: 55px;
  padding: 8px 9px;
  border-radius: var(--radius-control);
}

.category-icon,
.metric-icon,
.recent-icon,
.stream-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 10%, var(--app-control-background));
}

.category-icon {
  width: 30px;
  height: 30px;
  border-radius: var(--radius-control);
}
.category-arrow {
  color: var(--el-text-color-placeholder);
}

.artifact-detail {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--app-surface-border-strong);
  border-radius: var(--app-panel-radius);
  background: color-mix(in srgb, var(--app-card-background) 96%, var(--app-surface-background));
  box-shadow: none;
  overflow: hidden;
}

.artifact-detail__header {
  min-height: 70px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--workspace-border-soft);
  background: var(--app-container-background);
}

.artifact-detail__header > div:first-child > div {
  display: flex;
  align-items: baseline;
  gap: 9px;
}
.artifact-detail__header h1 {
  font-size: 16px;
}
.artifact-detail__header small {
  color: var(--el-text-color-secondary);
  font-size: 11px;
}
.artifact-detail__actions {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.artifact-detail__actions :deep(.el-button) {
  margin: 0;
}

.artifact-overview {
  flex: 1;
  min-height: 0;
  padding: 14px;
  overflow: auto;
}

.artifact-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 20px 22px;
  border: 1px solid var(--workspace-border-soft);
  border-radius: var(--radius-container);
  background: var(--app-container-background);
}

.artifact-hero h2 {
  margin: 6px 0;
  font-size: 20px;
  line-height: 1.35;
}
.artifact-hero p {
  max-width: 720px;
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 12.5px;
  line-height: 1.7;
}
.artifact-hero > .el-button {
  flex-shrink: 0;
}

.artifact-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px;
}

.artifact-metrics article {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 68px;
  padding: 11px 13px;
  border: 1px solid var(--workspace-border-soft);
  border-radius: var(--radius-container);
  background: var(--el-bg-color-overlay);
}

.metric-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-control);
  font-size: 17px;
}
.artifact-metrics small {
  display: block;
  color: var(--el-text-color-secondary);
  font-size: 10.5px;
}
.artifact-metrics strong {
  display: block;
  margin-top: 3px;
  font-size: 16px;
}

.artifact-overview__grid {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(300px, 0.75fr);
  gap: 12px;
  margin-top: 12px;
}

.overview-panel {
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--workspace-border-soft);
  border-radius: var(--radius-container);
  background: var(--el-bg-color-overlay);
}

.overview-panel h3 {
  font-size: 14px;
}
.recent-artifact-list,
.artifact-streams {
  gap: 7px;
  margin-top: 12px;
}
.recent-artifact-list button,
.artifact-streams button {
  display: grid;
  align-items: center;
  gap: 10px;
  min-height: 54px;
  padding: 8px 9px;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 36%, transparent);
  border-radius: var(--radius-control);
  background: var(--workspace-surface-raised);
}
.recent-artifact-list button {
  grid-template-columns: 32px minmax(0, 1fr) 16px;
}
.artifact-streams button {
  grid-template-columns: 32px minmax(0, 1fr) auto;
}
.recent-artifact-list button:hover,
.artifact-streams button:hover {
  border-color: color-mix(in srgb, var(--el-color-primary) 48%, var(--el-border-color));
}
.recent-icon,
.stream-icon {
  width: 30px;
  height: 30px;
  border-radius: var(--radius-control);
}
.recent-artifact-list strong,
.artifact-streams strong {
  font-size: 12px;
}
.recent-artifact-list small,
.artifact-streams small {
  margin-top: 3px;
  color: var(--el-text-color-secondary);
  font-size: 10.5px;
}
.artifact-streams em {
  min-width: 24px;
  padding: 3px 7px;
  border-radius: 99px;
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 10%, transparent);
  font-size: 11px;
  font-style: normal;
  text-align: center;
}

.artifact-empty {
  min-height: 190px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--el-text-color-secondary);
  text-align: center;
}
.artifact-empty .el-icon {
  color: var(--el-color-primary);
  font-size: 24px;
}
.artifact-empty strong {
  color: var(--el-text-color-primary);
  font-size: 13px;
}
.artifact-empty span {
  font-size: 11px;
}

.artifact-browser-workbench {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(250px, 300px);
  gap: 10px;
  padding: 10px;
  overflow: hidden;
}

@media (max-width: 1100px) {
  .artifact-browser-workbench {
    grid-template-columns: minmax(0, 1fr) 260px;
  }
  .artifact-overview__grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .artifact-detail__header,
  .artifact-hero {
    align-items: flex-start;
    flex-direction: column;
  }
  .artifact-detail__actions {
    justify-content: flex-start;
  }
  .artifact-metrics {
    grid-template-columns: 1fr;
  }
  .artifact-browser-workbench {
    grid-template-columns: 1fr;
    overflow: auto;
  }
}
</style>
