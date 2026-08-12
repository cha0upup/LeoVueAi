<template>
  <section class="browser-panel">
    <div class="browser-toolbar">
      <div class="path-bar">
        <el-button
          text
          class="path-home-btn"
          aria-label="返回成果库根目录"
          @click="emitGoRoot"
        >
          <el-icon><Icon :icon="iconMap.homeFilled" /></el-icon>
        </el-button>
        <div class="path-copy">
          <span>ARTIFACT BROWSER</span>
          <el-breadcrumb
            separator="/"
            class="path-breadcrumb"
          >
            <el-breadcrumb-item>
              <a
                href="#"
                @click.prevent="emitGoRoot"
              >全部成果</a>
            </el-breadcrumb-item>
            <el-breadcrumb-item
              v-for="segment in pathSegments"
              :key="segment.path"
            >
              <a
                href="#"
                @click.prevent="emitGoPath(segment.path)"
              >{{
                resolvePathLabel(segment.name)
              }}</a>
            </el-breadcrumb-item>
          </el-breadcrumb>
        </div>
      </div>

      <div class="toolbar-actions">
        <el-input
          v-model="localSearchKeyword"
          placeholder="搜索名称或路径"
          clearable
          class="search-input"
        >
          <template #prefix>
            <el-icon><Icon :icon="iconMap.search" /></el-icon>
          </template>
        </el-input>
        <el-button
          title="刷新"
          circle
          :loading="loading"
          @click="emitFetchList"
        >
          <el-icon><Icon :icon="iconMap.refresh" /></el-icon>
        </el-button>
      </div>
    </div>

    <input
      ref="uploadInputRef"
      type="file"
      class="hidden-input"
      @change="emitHandleUploadChange"
    >

    <div class="file-list">
      <div class="file-list-head">
        <span class="col-name">名称</span>
        <span class="col-kind">类型</span>
        <span class="col-size">大小</span>
        <span class="col-time">更新时间</span>
      </div>

      <div
        v-if="loading && !displayedFileList.length"
        class="list-loading"
      >
        <el-skeleton
          :rows="8"
          animated
        />
      </div>

      <template v-else-if="displayedFileList.length">
        <button
          v-for="row in displayedFileList"
          :key="row.path"
          type="button"
          class="entry-item"
          :class="{ active: selectedEntry?.path === row.path }"
          @click="emitSelectEntry(row)"
          @dblclick="emitPrimaryAction(row)"
        >
          <span class="entry-name">
            <span
              class="item-icon-shell"
              :class="{ 'is-dir': row.isDirectory }"
            >
              <el-icon class="item-icon"><Icon :icon="resolveEntryIcon(row)" /></el-icon>
            </span>
            <span class="item-main">
              <strong>{{ row.name }}</strong>
              <small>{{ row.path }}</small>
            </span>
          </span>
          <span class="entry-kind">
            <el-tag
              size="small"
              effect="light"
              :type="row.isDirectory ? 'success' : 'info'"
              class="entry-kind-tag workbench-type-tag"
            >
              {{ row.isDirectory ? '目录' : getFileExtension(row.name) || '文件' }}
            </el-tag>
          </span>
          <span class="entry-size">{{ row.isDirectory ? '-' : formatFileSize(row.size) }}</span>
          <span class="entry-time">{{ formatTimestamp(row.lastModified) }}</span>
          <div class="row-actions">
            <el-button
              v-if="row.isDirectory"
              size="small"
              text
              @click.stop="emitEnterDirectory(row)"
            >
              打开
            </el-button>
            <el-button
              v-else
              size="small"
              text
              @click.stop="emitPreviewFile(row)"
            >
              预览
            </el-button>
          </div>
        </button>
      </template>

      <div
        v-else
        class="list-empty"
      >
        <el-empty
          :description="searchKeyword ? '没有匹配项' : '目录为空'"
          :image-size="72"
        >
          <el-button
            v-if="searchKeyword"
            @click="emitClearSearch"
          >
            清空筛选
          </el-button>
          <el-button
            v-else
            type="primary"
            @click="emitTriggerUpload"
          >
            上传文件
          </el-button>
        </el-empty>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { icons } from '@/utils/icons.js'
import { formatDate, formatFileSize } from '@/utils/format.js'
import {
  filterUserSpaceEntries,
  getUserSpaceEntryIconKey,
  getUserSpaceFileExtension,
  resolveArtifactCategoryLabel,
  sortUserSpaceEntries
} from './userSpaceModel.js'

const iconMap = icons
const uploadInputRef = ref(null)

const props = defineProps({
  loading: {
    type: Boolean,
    default: false
  },
  currentPath: {
    type: String,
    default: ''
  },
  fileList: {
    type: Array,
    default: () => []
  },
  searchKeyword: {
    type: String,
    default: ''
  },
  selectedEntry: {
    type: Object,
    default: null
  }
})

const emit = defineEmits([
  'fetch-list',
  'go-root',
  'go-path',
  'enter-directory',
  'preview-file',
  'trigger-upload',
  'handle-upload-change',
  'select-entry',
  'search-keyword-change',
  'clear-search'
])

const localSearchKeyword = computed({
  get: () => props.searchKeyword,
  set: (value) => emit('search-keyword-change', value)
})

const pathSegments = computed(() => {
  if (!props.currentPath) return []
  const parts = props.currentPath.split('/').filter(Boolean)
  return parts.map((name, index) => ({
    name,
    path: parts.slice(0, index + 1).join('/')
  }))
})
const resolvePathLabel = (name) => resolveArtifactCategoryLabel(name)

const filteredFileList = computed(() => filterUserSpaceEntries(props.fileList, props.searchKeyword))

const displayedFileList = computed(() => sortUserSpaceEntries(filteredFileList.value))

const formatTimestamp = (value) => formatDate(value)
const getFileExtension = (path) => getUserSpaceFileExtension(path)
const resolveEntryIcon = (row) => iconMap[getUserSpaceEntryIconKey(row)] || iconMap.file

// Emit methods
const emitFetchList = () => emit('fetch-list')
const emitGoRoot = () => emit('go-root')
const emitGoPath = (path) => emit('go-path', path)
const emitEnterDirectory = (row) => emit('enter-directory', row)
const emitPreviewFile = (row) => emit('preview-file', row)
const emitTriggerUpload = () => emit('trigger-upload')
const emitHandleUploadChange = (event) => emit('handle-upload-change', event)
const emitSelectEntry = (row) => emit('select-entry', row)
const emitClearSearch = () => emit('search-keyword-change', '')
const emitPrimaryAction = (row) => {
  emitSelectEntry(row)
  if (row?.isDirectory) {
    emitEnterDirectory(row)
  } else {
    emitPreviewFile(row)
  }
}

const triggerUpload = () => {
  if (!uploadInputRef.value) return
  uploadInputRef.value.value = ''
  uploadInputRef.value.click()
}

defineExpose({ triggerUpload })
</script>

<style scoped>
@import '@/styles/workbench-toolbar-shared.css';

.browser-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
  border-radius: var(--radius-container);
  border: 1px solid var(--workspace-border-soft);
  background: var(--el-bg-color-overlay);
  overflow: hidden;
}

.browser-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 24%, transparent);
  background: var(--app-container-background);
}

.path-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.path-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.path-copy > span {
  color: var(--el-text-color-placeholder);
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 0.08em;
  line-height: 1;
}

.path-breadcrumb {
  min-width: 0;
  overflow: hidden;
}

.path-breadcrumb :deep(.el-breadcrumb__inner),
.path-breadcrumb :deep(.el-breadcrumb__inner a) {
  color: var(--el-text-color-regular);
  font-weight: 600;
}

.path-home-btn {
  padding: 4px;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.search-input :deep(.el-input__wrapper) {
  width: 260px;
  border-radius: 6px;
}

.file-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.file-list-head,
.entry-item {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) 96px 96px 152px 58px;
  align-items: center;
  gap: 12px;
}

.file-list-head {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 8px 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 18%, transparent);
  background: color-mix(in srgb, var(--app-surface-background) 98%, var(--el-bg-color-overlay));
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: 700;
}

.entry-item {
  width: 100%;
  min-height: 44px;
  padding: 7px 12px;
  border: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 14%, transparent);
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background 0.2s ease;
}

.entry-item:hover {
  background: color-mix(in srgb, var(--el-color-primary) 5%, transparent);
}

.entry-item.active {
  background: var(--app-selected-background);
  box-shadow: inset 3px 0 0 var(--el-color-primary);
}

.entry-name {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.item-icon-shell {
  width: 30px;
  height: 30px;
  border-radius: var(--radius-control);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 12%, var(--app-control-background));
}

.item-icon-shell.is-dir {
  color: var(--el-color-success);
  background: color-mix(in srgb, var(--el-color-success) 14%, var(--app-control-background));
}

.item-main {
  min-width: 0;
}

.item-main strong,
.item-main span {
  display: block;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-main strong {
  font-size: 13px;
  margin-bottom: 2px;
}

.item-main small {
  font-size: 10.5px;
  color: var(--el-text-color-secondary);
  font-family: var(--el-font-family-mono);
}

.entry-size,
.entry-time {
  font-size: 11.5px;
  color: var(--el-text-color-secondary);
}

.row-actions {
  display: flex;
  justify-content: flex-end;
}

.list-loading,
.list-empty {
  padding: 20px 14px;
}

.hidden-input {
  display: none;
}

@media (max-width: 768px) {
  .browser-toolbar {
    grid-template-columns: 1fr;
  }

  .toolbar-actions {
    width: 100%;
  }

  .search-input,
  .search-input :deep(.el-input__wrapper) {
    width: 100%;
  }

  .file-list-head {
    display: none;
  }

  .entry-item {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
  }

  .entry-kind,
  .entry-size,
  .entry-time {
    display: none;
  }
}
</style>
