<template>
  <div
    ref="workspaceRef"
    class="file-workspace"
    :class="{ 'is-sidebar-open': sidebarOpen }"
    @keydown.esc="sidebarOpen = false"
  >
    <header class="workspace-toolbar">
      <el-button
        text
        :aria-expanded="sidebarOpen"
        :aria-label="sidebarOpen ? '收起目录栏' : '展开目录栏'"
        :title="sidebarOpen ? '收起目录栏' : '展开目录栏'"
        @click="sidebarOpen = !sidebarOpen"
      >
        <Icon :icon="ICON_MAP.menu" />
      </el-button>
      <el-button
        text
        :disabled="!canGoBack"
        aria-label="上一级目录"
        title="上一级目录"
        @click="goToParentDirectory"
      >
        <Icon :icon="ICON_MAP.arrowUp" />
      </el-button>
      <el-button
        text
        aria-label="根目录"
        title="根目录"
        @click="goToRoot"
      >
        <Icon :icon="ICON_MAP.homeFilled" />
      </el-button>
      <el-select
        v-if="isWindows && diskList.length"
        v-model="selectedDisk"
        size="small"
        class="disk-select"
        aria-label="选择盘符"
        @change="handleDiskChange"
      >
        <el-option
          v-for="item in diskList"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>
      <nav
        v-if="!isPathEditing"
        class="path-surface"
        aria-label="当前目录路径"
        :title="currentFullPath"
        @dblclick="startPathEditing"
      >
        <template
          v-for="(crumb, index) in displayBreadcrumbs"
          :key="crumb.link"
        >
          <Icon
            v-if="index"
            class="path-separator"
            :icon="ICON_MAP.arrowRight"
          />
          <button
            type="button"
            class="path-segment"
            :aria-current="index === displayBreadcrumbs.length - 1 ? 'location' : undefined"
            @click="goToPath(crumb.link)"
          >
            {{ crumb.text }}
          </button>
        </template>
        <el-button
          text
          aria-label="编辑路径"
          title="编辑路径"
          @click="startPathEditing"
        >
          <Icon :icon="ICON_MAP.edit" />
        </el-button>
      </nav>
      <el-input
        v-else
        ref="pathInputRef"
        v-model="pathInput"
        size="small"
        class="path-input"
        aria-label="目录路径"
        @keyup.enter="handlePathInput"
        @keyup.esc.stop="cancelPathEditing"
        @blur="cancelPathEditing"
      />
      <el-button
        size="small"
        :loading="isLoading"
        @click="refreshFiles"
      >
        <Icon :icon="ICON_MAP.refresh" /> 刷新
      </el-button>
    </header>
    <div class="workspace-body">
      <button
        v-if="sidebarOpen"
        type="button"
        class="sidebar-backdrop"
        aria-label="关闭目录导航"
        @click="sidebarOpen = false"
      />
      <aside
        v-show="sidebarOpen"
        class="workspace-sidebar"
        aria-label="目录导航"
      >
        <div class="sidebar-heading">
          <strong>目录</strong><el-button
            text
            aria-label="收起目录栏"
            @click="sidebarOpen = false"
          >
            <Icon :icon="ICON_MAP.close" />
          </el-button>
        </div>
        <FileTree
          v-if="fileSystemProfile"
          ref="fileTreeRef"
          :session-id="sessionId"
          :current-path="currentFullPath"
          :current-disk="disk"
          :is-windows="isWindows"
          :roots="fileSystemProfile.roots || []"
          @select-path="goToPath"
        />
      </aside>
      <main class="workspace-main">
        <div class="main-actions">
          <div class="action-group">
            <el-dropdown
              trigger="click"
              @command="createEntry"
            >
              <el-button
                size="small"
                aria-label="新建文件或文件夹"
              >
                <Icon :icon="ICON_MAP.plus" /> 新建 <Icon :icon="ICON_MAP.arrowDown" />
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="file">
                    新建文件
                  </el-dropdown-item><el-dropdown-item command="folder">
                    新建文件夹
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <el-button
              size="small"
              @click="uploadFile"
            >
              <Icon :icon="ICON_MAP.upload" /> 上传
            </el-button>
            <el-button
              v-if="fileCapabilities.grep"
              size="small"
              title="递归搜索当前目录及子目录的文件内容"
              @click="openGrep"
            >
              <Icon :icon="ICON_MAP.search" /> 搜索内容
            </el-button>
            <el-dropdown
              v-if="fileCapabilities.pack"
              trigger="click"
              @command="openPack"
            >
              <el-button
                text
                aria-label="更多目录操作"
                title="更多目录操作"
              >
                <Icon :icon="ICON_MAP.more" />
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="pack">
                    打包当前目录
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
          <div class="filter-group">
            <el-input
              v-model="searchKeyword"
              placeholder="筛选当前目录"
              aria-label="筛选当前目录的名称或扩展名"
              title="按名称或扩展名筛选，不搜索子目录"
              clearable
              size="small"
              class="search-input"
            >
              <template #prefix>
                <Icon :icon="ICON_MAP.search" />
              </template>
            </el-input>
            <el-radio-group
              v-model="viewMode"
              size="small"
              aria-label="文件视图"
            >
              <el-radio-button
                value="list"
                aria-label="列表视图"
                title="列表视图"
              >
                <Icon :icon="ICON_MAP.list" />
              </el-radio-button>
              <el-radio-button
                value="grid"
                aria-label="网格视图"
                title="网格视图"
              >
                <Icon :icon="ICON_MAP.grid" />
              </el-radio-button>
            </el-radio-group>
          </div>
        </div>
        <FileTable
          ref="fileTableRef"
          :session-id="sessionId"
          :search-keyword="searchKeyword"
          :view-mode="viewMode"
          @change-disk="handleDiskChangeFromTable"
          @change-current-path="handlePathChange"
          @loading="handleLoadingChange"
        />
      </main>
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
import { computed, ref, watch, onMounted, nextTick, provide } from 'vue'
import { icons } from '@/utils/icons.js'
import { formatFilePath } from '@/utils/format.js'
import {
  useFilePath,
  buildFullPath as buildPath,
  parseAbsolutePath
} from '@/composables/useFilePath.js'
import { useFileSystem } from '@/composables/useFileSystem.js'
import { FILE_CAPABILITIES_KEY } from './fileCapabilities.js'
import FileTree from '@/components/PuppetConsole/File/FileTree.vue'
import FileTable from '@/components/PuppetConsole/File/FileTable.vue'
import FileCreate from '@/components/PuppetConsole/File/FileCreate.vue'
import FileUpload from '@/components/PuppetConsole/File/FileUpload.vue'
import FileGrep from '@/components/PuppetConsole/File/FileGrep.vue'
import FilePack from '@/components/PuppetConsole/File/FilePack.vue'

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
const pathInputRef = ref(null)
const sidebarOpen = ref(false)
const workspaceRef = ref(null)
const fileTreeRef = ref(null)

// 组件引用
const fileTableRef = ref(null)
const fileCreateRef = ref(null)
const fileUploadRef = ref(null)
const fileGrepRef = ref(null)
const filePackRef = ref(null)

// 使用 composables
const { diskList, selectedDisk, isWindows, fileSystemProfile, isLoading, loadDisks } =
  useFileSystem({ sessionId: props.sessionId })

const fileCapabilities = computed(() => fileSystemProfile.value?.capabilities || {})
provide(FILE_CAPABILITIES_KEY, fileCapabilities)

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
  if (currentPath.value !== path) searchKeyword.value = ''
  currentPath.value = path
}

/**
 * 刷新文件管理视图
 */
const refreshFiles = async () => {
  await loadDisks()
  const targetPath = buildPath(disk.value, currentPath.value)
  if (targetPath) {
    await Promise.all([fileTableRef.value?.getList(targetPath), fileTreeRef.value?.refresh()])
  }
}

const handleCreatedEntry = async (entry) => {
  if (!entry?.open || entry.type !== 'file') return
  await nextTick()
  fileTableRef.value?.previewFile(entry.path)
}

/**
 * 创建文件
 */
const createEntry = (type) => {
  fileCreateRef.value?.openDialog(props.sessionId, currentFullPath.value, type)
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
  fileUploadRef.value?.openDialog(props.sessionId, buildPath(disk.value, currentPath.value))
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
  searchKeyword.value = ''

  const lastSlashIndex = currentPath.value.lastIndexOf('/')
  const parentPath = lastSlashIndex > 0 ? currentPath.value.substring(0, lastSlashIndex) : ''
  fileTableRef.value?.getList(buildPath(disk.value, parentPath))
}

/**
 * 跳转到指定路径
 */
const goToPath = (path) => {
  if (!path) return
  searchKeyword.value = ''
  if (workspaceRef.value?.clientWidth <= 760) sidebarOpen.value = false

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
const startPathEditing = async () => {
  isPathEditing.value = true
  pathInput.value = currentFullPath.value
  await nextTick()
  pathInputRef.value?.focus()
  pathInputRef.value?.select()
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
  const rootPath =
    isWindows.value && disk.value.startsWith('//')
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
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  min-width: 0;
  container-type: inline-size;
  background: var(--app-card-background);
}
.workspace-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.file-workspace :deep(.el-button + .el-button) {
  margin-left: 0;
}
.file-workspace :deep(.el-button.is-text) {
  height: 28px;
  padding: 6px;
}
.file-workspace :deep(.el-button .iconify) {
  font-size: 15px;
}
.path-surface,
.path-input {
  flex: 1;
  min-width: 0;
}
.path-surface {
  display: flex;
  align-items: center;
  gap: 2px;
  overflow-x: auto;
  scrollbar-width: thin;
}
.path-segment {
  flex-shrink: 0;
  border: 0;
  background: transparent;
  color: var(--el-text-color-regular);
  font-size: 13px;
  padding: 4px;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
}
.path-segment:hover {
  background: var(--app-control-background-hover);
}
.path-segment[aria-current] {
  color: var(--el-color-primary);
  font-weight: 600;
}
.path-segment:focus-visible {
  outline: 2px solid var(--el-color-primary);
}
.path-separator {
  flex-shrink: 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.disk-select {
  width: 76px;
  flex-shrink: 0;
}
.workspace-body {
  position: relative;
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}
.is-sidebar-open .workspace-body {
  grid-template-columns: 180px minmax(0, 1fr);
}
.workspace-sidebar {
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 8px;
  background: var(--app-card-background);
  border-right: 1px solid var(--el-border-color-lighter);
}
.sidebar-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px 8px;
  font-size: 12px;
}
.workspace-sidebar :deep(.file-tree) {
  flex: 1;
  min-height: 0;
}
.workspace-main {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.workspace-main :deep(.file-table-container) {
  flex: 1;
  height: auto;
}
.main-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px 12px;
  padding: 8px 10px 4px;
}
.action-group,
.filter-group {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.filter-group {
  margin-left: auto;
  flex: 0 1 auto;
}
.search-input {
  width: 180px;
  min-width: 120px;
}
.filter-group .el-radio-group {
  flex-wrap: nowrap;
}
.sidebar-backdrop {
  display: none;
}
@container (max-width: 760px) {
  .is-sidebar-open .workspace-body {
    grid-template-columns: minmax(0, 1fr);
  }
  .workspace-sidebar {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: min(240px, 80%);
    z-index: 12;
    box-shadow: var(--el-box-shadow-light);
  }
  .sidebar-backdrop {
    display: block;
    position: absolute;
    inset: 0 0 0 min(240px, 80%);
    z-index: 11;
    border: 0;
    background: rgb(0 0 0 / 15%);
  }
}
@container (max-width: 520px) {
  .filter-group {
    flex: 1 1 100%;
  }
  .search-input {
    flex: 1;
    width: auto;
  }
}
</style>
