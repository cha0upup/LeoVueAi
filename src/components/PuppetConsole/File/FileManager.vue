<template>
  <div class="file-workspace">
    <div class="workspace-shell">
      <header class="workspace-toolbar">
        <div class="toolbar-primary">
          <el-button-group class="nav-group">
            <el-button
              :disabled="!canGoBack"
              size="small"
              title="上一级"
              @click="goToParentDirectory"
            >
              <el-icon><Icon :icon="ICON_MAP.arrowLeft" /></el-icon>
            </el-button>
            <el-button
              size="small"
              title="根目录"
              @click="goToRoot"
            >
              <el-icon><Icon :icon="ICON_MAP.homeFilled" /></el-icon>
            </el-button>
          </el-button-group>

          <div
            v-if="!isPathEditing"
            class="path-surface"
            @click="startPathEditing"
          >
            <div
              v-for="(crumb, index) in displayBreadcrumbs"
              :key="index"
              class="path-segment"
            >
              <button
                type="button"
                class="path-segment-text"
                :class="{ 'path-segment-active': index === displayBreadcrumbs.length - 1 }"
                @click.stop="goToPath(crumb.link)"
              >
                {{ crumb.text }}
              </button>
              <el-icon
                v-if="index < displayBreadcrumbs.length - 1"
                class="path-separator"
              >
                <Icon :icon="ICON_MAP.arrowRight" />
              </el-icon>
            </div>
            <el-icon class="path-edit-icon">
              <Icon :icon="ICON_MAP.edit" />
            </el-icon>
          </div>

          <div
            v-else
            class="path-input-wrap"
          >
            <el-input
              v-model="pathInput"
              size="small"
              class="path-input"
              autofocus
              @keyup.enter="handlePathInput"
              @keyup.esc="cancelPathEditing"
              @blur="cancelPathEditing"
            >
              <template #prefix>
                <el-icon><Icon :icon="ICON_MAP.folder" /></el-icon>
              </template>
              <template #suffix>
                <el-icon
                  class="path-input-icon"
                  @click="handlePathInput"
                >
                  <Icon :icon="ICON_MAP.check" />
                </el-icon>
                <el-icon
                  class="path-input-icon"
                  @click="cancelPathEditing"
                >
                  <Icon :icon="ICON_MAP.close" />
                </el-icon>
              </template>
            </el-input>
          </div>
        </div>

        <div class="toolbar-secondary">
          <el-input
            v-model="searchKeyword"
            placeholder="搜索名称或扩展名"
            class="search-input"
            clearable
            size="small"
          >
            <template #prefix>
              <el-icon><Icon :icon="ICON_MAP.search" /></el-icon>
            </template>
          </el-input>

          <el-radio-group
            v-model="viewMode"
            size="small"
            class="view-mode-group"
          >
            <el-radio-button
              value="list"
              title="列表"
            >
              <el-icon><Icon :icon="ICON_MAP.list" /></el-icon>
            </el-radio-button>
            <el-radio-button
              value="grid"
              title="网格"
            >
              <el-icon><Icon :icon="ICON_MAP.grid" /></el-icon>
            </el-radio-button>
          </el-radio-group>

          <el-button
            :loading="isLoading"
            size="small"
            class="refresh-button"
            @click="refreshFiles"
          >
            <el-icon><Icon :icon="ICON_MAP.refresh" /></el-icon>
            刷新
          </el-button>
        </div>
      </header>

      <div class="workspace-body">
        <aside class="workspace-sidebar">
          <div class="sidebar-top">
            <el-select
              v-if="isWindows && diskList.length > 0"
              v-model="selectedDisk"
              size="small"
              class="disk-select"
              placeholder="选择盘符"
              @change="handleDiskChange"
            >
              <el-option
                v-for="item in diskList"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              >
                <div class="disk-option">
                  <el-icon class="disk-icon">
                    <Icon :icon="ICON_MAP.hardDrive" />
                  </el-icon>
                  <span>{{ item.label }}</span>
                </div>
              </el-option>
            </el-select>

            <div
              v-else
              class="sidebar-root"
            >
              <el-icon><Icon :icon="ICON_MAP.folder" /></el-icon>
              <span>目录</span>
              <code>/</code>
            </div>
          </div>

          <div class="sidebar-tree">
            <FileTree
              v-if="fileSystemProfile"
              :session-id="sessionId"
              :current-path="currentFullPath"
              :current-disk="disk"
              :is-windows="isWindows"
              :roots="fileSystemProfile.roots || []"
              @select-path="goToPath"
            />
          </div>
        </aside>

        <main class="workspace-main">
          <div class="main-actions">
            <div class="main-actions__group">
              <el-button
                size="small"
                type="primary"
                @click="createFile"
              >
                <el-icon><Icon :icon="ICON_MAP.documentAdd" /></el-icon>
                新建文件
              </el-button>
              <el-button
                class="semantic-button is-folder"
                size="small"
                @click="createFolder"
              >
                <el-icon><Icon :icon="ICON_MAP.folderAdd" /></el-icon>
                新建文件夹
              </el-button>
              <el-button
                class="semantic-button is-upload"
                size="small"
                @click="uploadFile"
              >
                <el-icon><Icon :icon="ICON_MAP.upload" /></el-icon>
                上传
              </el-button>
            </div>
            <div class="main-actions__group is-utility">
              <el-button
                class="semantic-button is-search"
                size="small"
                title="递归搜索文件内容"
                @click="openGrep"
              >
                <el-icon><Icon :icon="ICON_MAP.search" /></el-icon>
                内容搜索
              </el-button>
              <el-button
                class="semantic-button is-archive"
                size="small"
                title="打包当前目录为 tar.gz"
                @click="openPack"
              >
                <el-icon><Icon :icon="ICON_MAP.compress" /></el-icon>
                打包目录
              </el-button>
            </div>
          </div>

          <div class="main-content">
            <FileTable
              ref="fileTableRef"
              :session-id="sessionId"
              :search-keyword="searchKeyword"
              :view-mode="viewMode"
              @change-disk="handleDiskChangeFromTable"
              @change-current-path="handlePathChange"
              @loading="handleLoadingChange"
            />
          </div>
        </main>
      </div>
    </div>
  </div>

  <FileCreate
    ref="fileCreateRef"
    @refresh="refreshFiles"
    @created="handleCreatedEntry"
  />
  <FileUpload
    ref="fileUploadRef"
    :session-id="sessionId"
  />
  <FileGrep
    ref="fileGrepRef"
    :session-id="sessionId"
  />
  <FilePack
    ref="filePackRef"
    :session-id="sessionId"
  />
</template>

<script setup>
import { computed, ref, watch, onMounted, nextTick } from 'vue'
import { icons } from '@/utils/icons.js'
import { formatFilePath } from '@/utils/format.js'
import {
  useFilePath,
  buildFullPath as buildPath,
  parseAbsolutePath
} from '@/composables/useFilePath.js'
import { useFileSystem } from '@/composables/useFileSystem.js'
import FileTree from '@/components/PuppetConsole/File/FileTree.vue'
import FileTable from '@/components/PuppetConsole/File/FileTable.vue'
import FileCreate from '@/components/PuppetConsole/File/FileCreate.vue'
import FileUpload from '@/components/PuppetConsole/File/FileUpload.vue'
import FileGrep   from '@/components/PuppetConsole/File/FileGrep.vue'
import FilePack   from '@/components/PuppetConsole/File/FilePack.vue'

/**
 * 文件管理组件 - macOS Finder 风格
 * 提供文件浏览、管理功能，支持 Windows 和 Linux 文件系统
 */

const props = defineProps({
  sessionId: {
    type: String,
    required: true
  }
})

// 常量定义
const ICON_MAP = icons
const DEFAULT_DISK = '/'
const DEFAULT_VIEW_MODE = 'list'

// 响应式数据
const currentPath = ref('')
const disk = ref(DEFAULT_DISK)
const searchKeyword = ref('')
const viewMode = ref(DEFAULT_VIEW_MODE)
const isPathEditing = ref(false)
const pathInput = ref('')

// 组件引用
const fileTableRef = ref(null)
const fileCreateRef = ref(null)
const fileUploadRef = ref(null)
const fileGrepRef   = ref(null)
const filePackRef   = ref(null)

// 使用 composables
const {
  diskList,
  selectedDisk,
  isWindows,
  fileSystemProfile,
  isLoading,
  loadDisks
} = useFileSystem({ sessionId: props.sessionId })

// 路径导航相关
const { breadcrumbs, currentFullPath, canGoBack } = useFilePath({ disk, currentPath })
const displayBreadcrumbs = computed(() => breadcrumbs.value.filter((crumb) => crumb.text !== '.'))

/**
 * 处理磁盘切换
 */
const handleDiskChange = (newDisk) => {
  if (!newDisk) return

  disk.value = newDisk
  selectedDisk.value = newDisk
  currentPath.value = ''

  const diskPath = formatFilePath(`${newDisk}/`)
  goToPath(diskPath)
}

/**
 * 从 FileTable 接收磁盘变化
 */
const handleDiskChangeFromTable = (newDisk) => {
  disk.value = newDisk
  if (isWindows.value && /^[A-Za-z]:$/.test(newDisk)) {
    selectedDisk.value = newDisk
  }
}

/**
 * 从 FileTable 接收路径变化
 */
const handlePathChange = (path) => {
  currentPath.value = path
}

/**
 * 刷新文件管理视图
 */
const refreshFiles = async () => {
  await loadDisks()
  const targetPath = buildPath(disk.value,currentPath.value)
  if (targetPath) {
    fileTableRef.value?.getList(targetPath)
  }
}

const handleCreatedEntry = async (entry) => {
  if (!entry?.open || entry.type !== 'file') return
  const extension = entry.name?.includes('.') ? entry.name.split('.').pop()?.toLowerCase() : ''
  await nextTick()
  fileTableRef.value?.previewFile(entry.path, {
    name: entry.name || '',
    size: Number(entry.size ?? 0),
    extension: extension || ''
  })
}

/**
 * 创建文件
 */
const createFile = () => {
  fileCreateRef.value?.openDialog(props.sessionId, currentFullPath.value, 'file')
}

/**
 * 创建文件夹
 */
const createFolder = () => {
  fileCreateRef.value?.openDialog(props.sessionId, currentFullPath.value, 'folder')
}

/**
 * 处理加载状态变化
 */
const handleLoadingChange = (val) => {
  isLoading.value = val
}

/**
 * 上传文件
 */
const uploadFile = () => {
  fileUploadRef.value?.openDialog(props.sessionId, buildPath(disk.value,currentPath.value))
}

const openGrep = () => {
  fileGrepRef.value?.openDialog(currentFullPath.value)
}

const openPack = () => {
  filePackRef.value?.openDialog(currentFullPath.value)
}

/**
 * 返回上一级目录
 */
const goToParentDirectory = () => {
  if (!canGoBack.value) return

  const lastSlashIndex = currentPath.value.lastIndexOf('/')
  const parentPath = lastSlashIndex > 0 ? currentPath.value.substring(0, lastSlashIndex) : ''
  fileTableRef.value?.getList(buildPath(disk.value,parentPath))
}

/**
 * 跳转到指定路径
 */
const goToPath = (path) => {
  if (!path) return

  const normalizedPath = formatFilePath(path)

  if (isWindows.value && (/^[A-Za-z]:/.test(normalizedPath) || normalizedPath.startsWith('//'))) {
    const parsed = parseAbsolutePath(normalizedPath)
    disk.value = parsed.disk
    if (/^[A-Za-z]:$/.test(parsed.disk)) {
      selectedDisk.value = parsed.disk
    }
    currentPath.value = parsed.relativePath
  } else {
    currentPath.value = normalizedPath === '/' ? '' : normalizedPath.replace(/^\//, '')
  }

  fileTableRef.value?.getList(normalizedPath)
}

/**
 * 开始路径编辑
 */
const startPathEditing = () => {
  isPathEditing.value = true
  pathInput.value = currentFullPath.value
}

/**
 * 取消路径编辑
 */
const cancelPathEditing = () => {
  isPathEditing.value = false
  pathInput.value = ''
}

/**
 * 处理路径输入
 */
const handlePathInput = () => {
  const inputPath = pathInput.value?.trim()
  if (!inputPath) {
    cancelPathEditing()
    return
  }

  let normalizedPath = inputPath

  if (!normalizedPath.startsWith('/') && !normalizedPath.match(/^[A-Za-z]:/)) {
    const current = currentFullPath.value
    if (current.endsWith('/')) {
      normalizedPath = formatFilePath(`${current}${normalizedPath}`)
    } else {
      normalizedPath = formatFilePath(`${current}/${normalizedPath}`)
    }
  } else {
    normalizedPath = formatFilePath(normalizedPath)
  }

  goToPath(normalizedPath)
  cancelPathEditing()
}

/**
 * 跳转到根目录
 */
const goToRoot = () => {
  const rootPath = isWindows.value && disk.value.startsWith('//')
    ? formatFilePath(`${disk.value}/`)
    : isWindows.value && selectedDisk.value
      ? formatFilePath(`${selectedDisk.value}/`)
      : '/'
  goToPath(rootPath)
}

/**
 * 监听磁盘变化，更新选中状态
 */
watch(
  () => disk.value,
  (newDisk) => {
    if (isWindows.value && /^[A-Za-z]:$/.test(newDisk)) {
      selectedDisk.value = newDisk
    }
  }
)

/**
 * 组件挂载时初始化
 */
onMounted(async () => {
  await loadDisks()
  if (isWindows.value && selectedDisk.value) {
    disk.value = selectedDisk.value
    fileTableRef.value?.getList(formatFilePath(`${selectedDisk.value}/`))
  } else {
    disk.value = '/'
    fileTableRef.value?.getList('/')
  }
})
</script>

<style scoped>
.file-workspace {
  --workspace-surface: var(--app-card-background);
  --workspace-muted-surface: var(--app-control-background-soft);
  --workspace-control-surface: var(--app-control-background);
  --workspace-soft-border: color-mix(in srgb, var(--el-border-color) 16%, transparent);
  display: flex;
  flex: 1;
  min-height: 0;
}

:global(html:not(.dark) .file-workspace),
:global(html[data-theme='light'] .file-workspace) {
  --workspace-muted-surface: var(--app-control-background-soft);
}

.workspace-shell {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0;
  overflow: hidden;
}

.workspace-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 44px;
  padding: 6px 10px;
  border-radius: 0;
  background: color-mix(in srgb, var(--workspace-muted-surface) 90%, transparent);
  border: 0;
  border-bottom: 1px solid var(--workspace-soft-border);
}

.toolbar-primary,
.toolbar-secondary {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.toolbar-primary {
  flex: 1;
}

.toolbar-secondary {
  flex-shrink: 0;
}

.path-surface,
.path-input-wrap {
  flex: 1;
  min-width: 0;
}

.path-surface {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 30px;
  padding: 3px 8px;
  border-radius: 6px;
  background: var(--workspace-control-surface);
  border: 1px solid color-mix(in srgb, var(--workspace-soft-border) 92%, transparent);
  overflow-x: auto;
  cursor: text;
}

.path-surface::-webkit-scrollbar {
  height: 4px;
}

.path-segment {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.path-segment-text {
  border: none;
  background: transparent;
  padding: 2px 6px;
  border-radius: 4px;
  color: var(--el-text-color-regular);
  font-size: 12px;
  cursor: pointer;
}

.path-segment-text:hover {
  background: var(--app-control-background-hover);
  color: var(--el-text-color-primary);
}

.path-segment-text.path-segment-active {
  color: var(--el-color-primary);
  font-weight: 600;
}

.path-separator,
.path-edit-icon {
  color: var(--el-text-color-placeholder);
  font-size: 13px;
}

.path-input :deep(.el-input__wrapper),
.search-input :deep(.el-input__wrapper),
.disk-select :deep(.el-input__wrapper) {
  border-radius: var(--radius-control);
  background: var(--workspace-control-surface);
  border: 1px solid color-mix(in srgb, var(--workspace-soft-border) 92%, transparent);
  box-shadow: none;
}

.path-input-icon {
  cursor: pointer;
  font-size: 14px;
}

.search-input {
  width: clamp(180px, 16vw, 250px);
}

.view-mode-group {
  flex-shrink: 0;
  padding: 2px;
  border-radius: 6px;
  background: var(--workspace-control-surface);
  border: 1px solid color-mix(in srgb, var(--workspace-soft-border) 92%, transparent);
}

.workspace-toolbar :deep(.el-radio-button__inner) {
  border: none !important;
  background: transparent;
  box-shadow: none !important;
  border-radius: 4px !important;
}

.workspace-toolbar :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  background: var(--workspace-surface);
  color: var(--el-text-color-primary);
}

.workspace-toolbar :deep(.el-button),
.main-actions :deep(.el-button) {
  border-radius: 6px;
  font-weight: 600;
  box-shadow: none;
}

.workspace-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(196px, 220px) minmax(0, 1fr);
  gap: 0;
}

.workspace-sidebar,
.workspace-main {
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: 0;
  background: var(--workspace-surface);
  border: 0;
  overflow: hidden;
}

.workspace-sidebar {
  padding: 7px;
  gap: 5px;
  border-right: 1px solid var(--workspace-soft-border);
}

.sidebar-top {
  flex-shrink: 0;
}

.sidebar-root {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  height: 32px;
  padding: 0 9px;
  border-radius: 5px;
  background: var(--workspace-muted-surface);
  border: 0;
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.sidebar-root code {
  margin-left: auto;
  color: var(--el-text-color-placeholder);
  font-family: var(--app-font-mono, monospace);
  font-size: 11px;
}

.sidebar-root .el-icon,
.path-input :deep(.el-input__prefix .el-icon) {
  color: var(--el-color-primary);
}

.sidebar-tree {
  flex: 1;
  min-height: 0;
}

.disk-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.disk-icon {
  color: var(--el-color-primary);
}

.workspace-main {
  padding: 0;
  gap: 0;
}

.main-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: space-between;
  min-height: 42px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--workspace-soft-border);
}

.main-actions__group {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.main-actions__group.is-utility {
  padding-left: 10px;
  border-left: 1px solid var(--workspace-soft-border);
}

.main-actions .semantic-button {
  --el-button-text-color: var(--el-text-color-regular);
  --el-button-border-color: color-mix(in srgb, var(--el-border-color) 56%, transparent);
  --el-button-bg-color: var(--workspace-control-surface);
  --el-button-hover-text-color: var(--el-color-primary);
  --el-button-hover-border-color: color-mix(in srgb, var(--el-color-primary) 32%, transparent);
  --el-button-hover-bg-color: color-mix(in srgb, var(--el-color-primary) 6%, var(--workspace-control-surface));
}

.semantic-button.is-folder {
  --el-button-text-color: var(--el-color-success);
  --el-button-border-color: color-mix(in srgb, var(--el-color-success) 24%, transparent);
  --el-button-bg-color: color-mix(in srgb, var(--el-color-success) 7%, var(--workspace-control-surface));
  --el-button-hover-text-color: var(--el-color-success);
  --el-button-hover-border-color: color-mix(in srgb, var(--el-color-success) 36%, transparent);
  --el-button-hover-bg-color: color-mix(in srgb, var(--el-color-success) 11%, var(--workspace-control-surface));
}

.semantic-button.is-upload,
.semantic-button.is-search {
  --el-button-text-color: var(--el-color-primary);
  --el-button-border-color: color-mix(in srgb, var(--el-color-primary) 24%, transparent);
  --el-button-bg-color: color-mix(in srgb, var(--el-color-primary) 7%, var(--workspace-control-surface));
  --el-button-hover-text-color: var(--el-color-primary);
  --el-button-hover-border-color: color-mix(in srgb, var(--el-color-primary) 36%, transparent);
  --el-button-hover-bg-color: color-mix(in srgb, var(--el-color-primary) 11%, var(--workspace-control-surface));
}

.semantic-button.is-archive {
  --el-button-text-color: var(--el-color-warning-dark-2);
  --el-button-border-color: color-mix(in srgb, var(--el-color-warning) 28%, transparent);
  --el-button-bg-color: color-mix(in srgb, var(--el-color-warning) 9%, var(--workspace-control-surface));
  --el-button-hover-text-color: var(--el-color-warning-dark-2);
  --el-button-hover-border-color: color-mix(in srgb, var(--el-color-warning) 40%, transparent);
  --el-button-hover-bg-color: color-mix(in srgb, var(--el-color-warning) 13%, var(--workspace-control-surface));
}

.main-actions .semantic-button.is-folder,
.main-actions .semantic-button.is-upload,
.main-actions .semantic-button.is-search,
.main-actions .semantic-button.is-archive {
  --el-button-text-color: var(--el-text-color-regular);
  --el-button-border-color: color-mix(in srgb, var(--el-border-color) 56%, transparent);
  --el-button-bg-color: var(--workspace-control-surface);
  --el-button-hover-text-color: var(--el-color-primary);
  --el-button-hover-border-color: color-mix(in srgb, var(--el-color-primary) 32%, transparent);
  --el-button-hover-bg-color: color-mix(in srgb, var(--el-color-primary) 6%, var(--workspace-control-surface));
}

.main-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

@media (max-width: 1100px) {
  .workspace-body {
    grid-template-columns: 220px minmax(0, 1fr);
  }
}

@media (max-width: 768px) {
  .workspace-shell {
    padding: 6px;
  }

  .workspace-toolbar {
    flex-direction: column;
  }

  .toolbar-primary,
  .toolbar-secondary {
    width: 100%;
    flex-wrap: wrap;
  }

  .search-input {
    width: 100%;
  }

  .workspace-body {
    grid-template-columns: 1fr;
  }

  .workspace-sidebar {
    max-height: 220px;
  }

  .main-actions {
    flex-direction: column;
  }
}
</style>
