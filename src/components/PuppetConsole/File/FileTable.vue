<template>
  <div class="file-table-container">
    <FileEntryBrowser
      v-model:entry-filter="entryFilter"
      v-model:selected-files="selectedFiles"
      :visible-files="visibleFiles"
      :loading="isLoading"
      :view-mode="viewMode"
      :total-count="sortedFiles.length"
      :directory-count="directoryCount"
      :file-count="fileCount"
      :empty-description="emptyDescription"
      @file-click="handleFileClick"
      @refresh="refreshCurrentFolder"
      @batch-delete="handleBatchDelete"
      @action="handleFileAction"
    />

    <FileOperationDialogs
      :key="sessionId"
      ref="fileOperationDialogsRef"
      :session-id="sessionId"
      :disk="disk"
      :current-path="currentPath"
      :absolute-path="absolutePath"
      @refresh="refreshCurrentFolder"
    />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { formatFilePath } from '@/utils/format.js'
import { getFileListApi, deleteFileApi } from '@/services/api.js'
import { parseAbsolutePath } from '@/composables/useFilePath.js'
import { showSuccess, showError } from '@/utils/messageUtils.js'
import { confirmAction } from '@/utils/confirmUtils.js'
import { handleError } from '@/utils/errorHandler.js'
import { createLatestRequestGuard } from '@/utils/latestRequestGuard.js'
import FileEntryBrowser from './FileEntryBrowser.vue'
import FileOperationDialogs from './FileOperationDialogs.vue'
import {
  filterFileEntries,
  normalizeFileEntries,
  resolveCurrentFileDirectory,
  resolveFileEntryPath,
  settleWithConcurrency,
  sortFileEntries,
  summarizeFileEntries
} from './fileTableModel.js'

/**
 * 文件列表组件
 * 支持列表和网格两种视图模式，提供文件浏览和操作功能
 */

const props = defineProps({
  sessionId: {
    type: String,
    required: true
  },
  searchKeyword: {
    type: String,
    default: ''
  },
  viewMode: {
    type: String,
    default: 'list',
    validator: (value) => ['list', 'grid'].includes(value)
  }
})

const emit = defineEmits(['changeDisk', 'changeCurrentPath', 'loading'])

// 响应式数据
const fileList = ref([])
const disk = ref('')
const currentPath = ref('')
const absolutePath = ref('')
const isLoading = ref(false)
const entryFilter = ref('all')
const requestGuard = createLatestRequestGuard(['list', 'batchDelete'])

// 共享文件操作对话框
const fileOperationDialogsRef = ref(null)

// 批量选择
const selectedFiles = ref([])

/**
 * 排序后的文件列表（文件夹优先）
 */
const sortedFiles = computed(() => sortFileEntries(fileList.value))

/**
 * 过滤后的文件列表（根据搜索关键词）
 */
const visibleFiles = computed(() => filterFileEntries(sortedFiles.value, {
  keyword: props.searchKeyword,
  type: entryFilter.value
}))
const fileSummary = computed(() => summarizeFileEntries(sortedFiles.value))
const directoryCount = computed(() => fileSummary.value.directories)
const fileCount = computed(() => fileSummary.value.files)
const emptyDescription = computed(() => {
  if (props.searchKeyword?.trim()) return '没有匹配的文件或文件夹'
  if (entryFilter.value === 'dir') return '当前目录没有文件夹'
  if (entryFilter.value === 'file') return '当前目录没有文件'
  return '当前文件夹为空'
})

/**
 * 处理文件点击
 */
const handleFileClick = (fileOrRow) => {
  const file = fileOrRow && fileOrRow.path !== undefined ? fileOrRow : fileOrRow?.row || fileOrRow

  if (!file) return

  if (file.isDirectory) {
    const targetPath = resolveFileEntryPath(file, {
      absolutePath: absolutePath.value,
      disk: disk.value,
      currentPath: currentPath.value
    })
    getList(targetPath)
  } else {
    fileOperationDialogsRef.value?.previewEntry(file)
  }
}

const previewFile = (path, fileMeta = {}) => {
  if (!path) return
  fileOperationDialogsRef.value?.preview(formatFilePath(path), fileMeta)
}

const openFileOperation = (action, file) => fileOperationDialogsRef.value?.open(action, file)

const handleCopyPath = async (file) => {
  const path = resolveFileEntryPath(file, {
    absolutePath: absolutePath.value,
    disk: disk.value,
    currentPath: currentPath.value
  })
  try {
    if (!globalThis.navigator?.clipboard?.writeText) throw new Error('clipboard unavailable')
    await globalThis.navigator.clipboard.writeText(path)
    showSuccess('路径已复制')
  } catch {
    showError('复制失败，请手动复制')
  }
}

const handleFileAction = (action, file) => {
  if (action === 'download') {
    fileOperationDialogsRef.value?.download(file)
  } else if (action === 'copy-path') {
    handleCopyPath(file)
  } else {
    openFileOperation(action, file)
  }
}

// 批量删除
const handleBatchDelete = async () => {
  if (selectedFiles.value.length === 0) return
  const operationSequence = requestGuard.next('batchDelete')
  const targets = selectedFiles.value.slice()
  const count = targets.length
  const operationContext = {
    sessionId: props.sessionId,
    directory: resolveCurrentFileDirectory(disk.value, currentPath.value),
    absolutePath: absolutePath.value,
    disk: disk.value,
    currentPath: currentPath.value
  }
  const confirmed = await confirmAction({
    title: '批量删除',
    message: `确定要删除选中的 ${count} 个文件/文件夹吗？此操作不可恢复。`,
    confirmButtonText: '确认删除'
  })
  if (
    !confirmed ||
    !requestGuard.isCurrent('batchDelete', operationSequence) ||
    props.sessionId !== operationContext.sessionId
  ) return

  selectedFiles.value = []
  const results = await settleWithConcurrency(targets, 4, file => deleteFileApi({
    sessionId: operationContext.sessionId,
    path: resolveFileEntryPath(file, operationContext)
  }))
  if (!requestGuard.isCurrent('batchDelete', operationSequence)) return
  const failed = results.filter(result => result.status === 'rejected').length
  if (failed === 0) showSuccess(`已删除 ${count} 个文件`)
  else showError(`${count - failed} 个删除成功，${failed} 个失败`)
  if (
    props.sessionId === operationContext.sessionId &&
    resolveCurrentFileDirectory(disk.value, currentPath.value) === operationContext.directory
  ) {
    getList(operationContext.directory)
  }
}

/**
 * 处理文件列表响应
 */
const processFileListResponse = (resp) => {
  const { absolutePath: respAbsolutePath = '', fileList: respFileList } = resp.data || {}
  absolutePath.value = respAbsolutePath

  // 使用 composable 中的 parseAbsolutePath
  const { disk: parsedDisk, relativePath } = parseAbsolutePath(respAbsolutePath)
  disk.value = parsedDisk
  currentPath.value = relativePath

  emit('changeDisk', parsedDisk)
  emit('changeCurrentPath', relativePath)

  fileList.value = normalizeFileEntries(respFileList)
  selectedFiles.value = []
  return resp
}

/**
 * 获取指定路径的文件列表
 */
const loadFileList = async (request, errorMessage) => {
  const sequence = requestGuard.next('list')
  isLoading.value = true
  emit('loading', true)
  try {
    const response = await request()
    if (!requestGuard.isCurrent('list', sequence)) return null
    return processFileListResponse(response)
  } catch (error) {
    if (!requestGuard.isCurrent('list', sequence)) return null
    handleError(error, { defaultMessage: errorMessage })
    return null
  } finally {
    if (requestGuard.isCurrent('list', sequence)) {
      isLoading.value = false
      emit('loading', false)
    }
  }
}

const getList = async (path) => {
  const formattedPath = formatFilePath(path)
  const sessionId = props.sessionId
  return loadFileList(
    () => getFileListApi({ sessionId, path: formattedPath }),
    '获取文件列表失败'
  )
}

/**
 * 刷新当前文件夹
 */
const refreshCurrentFolder = () => {
  getList(resolveCurrentFileDirectory(disk.value, currentPath.value))
}

watch(() => props.sessionId, () => {
  requestGuard.invalidate(['list', 'batchDelete'])
  fileList.value = []
  selectedFiles.value = []
  disk.value = ''
  currentPath.value = ''
  absolutePath.value = ''
  isLoading.value = false
  entryFilter.value = 'all'
  emit('loading', false)
})

watch([() => props.searchKeyword, () => props.viewMode, entryFilter], () => {
  selectedFiles.value = []
})

onBeforeUnmount(() => {
  requestGuard.invalidate(['list', 'batchDelete'])
  if (isLoading.value) emit('loading', false)
})

// 暴露方法给父组件
defineExpose({
  getList,
  refreshCurrentFolder,
  previewFile
})
</script>

<style scoped>
.file-table-container {
  --file-table-muted-surface: var(--app-control-background-soft);
  --file-table-panel-surface: var(--app-card-background);
  --file-table-raised-surface: var(--app-control-background);
  --file-table-selected-surface: var(--app-card-active-background);
  --file-table-soft-border: color-mix(in srgb, var(--el-border-color) 16%, transparent);
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

</style>
