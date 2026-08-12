<template>
  <div class="browser-content">
    <div class="browser-toolbar">
      <div class="browser-stats">
        <span class="stat-pill">全部 {{ totalCount }}</span>
        <span class="stat-pill">文件夹 {{ directoryCount }}</span>
        <span class="stat-pill">文件 {{ fileCount }}</span>
      </div>
      <div class="browser-filters">
        <button
          type="button"
          class="filter-chip"
          :class="{ active: entryFilter === 'all' }"
          @click="entryFilter = 'all'"
        >
          全部
        </button>
        <button
          type="button"
          class="filter-chip"
          :class="{ active: entryFilter === 'dir' }"
          @click="entryFilter = 'dir'"
        >
          文件夹
        </button>
        <button
          type="button"
          class="filter-chip"
          :class="{ active: entryFilter === 'file' }"
          @click="entryFilter = 'file'"
        >
          文件
        </button>
      </div>
    </div>

    <!-- 列表视图 -->
    <div
      v-if="viewMode === 'list'"
      class="table-container"
    >
      <div class="table-card-body">
        <!-- 批量操作栏 -->
        <div
          v-if="selectedFiles.length > 0"
          class="batch-toolbar"
        >
          <span class="batch-count">已选 {{ selectedFiles.length }} 项</span>
          <el-button
            size="small"
            type="danger"
            text
            @click="emit('batch-delete')"
          >
            <el-icon><Icon :icon="ICON_MAP.delete" /></el-icon>
            批量删除
          </el-button>
          <el-button
            size="small"
            text
            @click="selectedFiles = []"
          >
            取消选择
          </el-button>
        </div>

        <el-table
          v-if="!isLoading && visibleFiles.length > 0"
          :data="visibleFiles"
          :row-key="getFileEntryKey"
          stripe
          header-row-class-name="file-table-header"
          class="file-table"
          highlight-current-row
          size="small"
          @row-click="(row, col) => col?.type !== 'selection' && emit('file-click', row)"
          @selection-change="(val) => selectedFiles = val"
        >
          <el-table-column
            type="selection"
            width="40"
          />

          <el-table-column
            prop="name"
            label="名称"
            sortable
            min-width="300"
          >
            <template #default="scope">
              <div class="file-item">
                <span class="file-icon-shell">
                  <el-icon :class="getIconClass(scope.row)">
                    <Icon :icon="getIcon(scope.row)" />
                  </el-icon>
                </span>
                <span
                  class="file-name"
                  :title="scope.row.name"
                >{{ scope.row.name }}</span>
                <div class="file-tags">
                  <el-tag
                    v-if="scope.row.isSymlink"
                    type="info"
                    size="small"
                    class="symlink-tag"
                    :title="scope.row.symlinkTarget ? `-> ${scope.row.symlinkTarget}` : '符号链接'"
                  >
                    <el-icon style="font-size:10px">
                      <Icon :icon="ICON_MAP.symlink" />
                    </el-icon>
                    链接
                  </el-tag>
                  <el-tag
                    v-else-if="scope.row.isDirectory"
                    type="info"
                    size="small"
                  >
                    文件夹
                  </el-tag>
                  <el-tag
                    v-else-if="scope.row.extension"
                    :type="getExtensionTagType(scope.row.extension)"
                    size="small"
                  >
                    {{ scope.row.extension.toUpperCase() }}
                  </el-tag>
                </div>
              </div>
            </template>
          </el-table-column>

          <el-table-column
            prop="size"
            label="大小"
            sortable
            width="120"
          >
            <template #default="scope">
              <span v-if="!scope.row.isDirectory && scope.row.size !== undefined">{{
                formatFileSize(scope.row.size)
              }}</span>
              <span
                v-else
                class="text-muted"
              >-</span>
            </template>
          </el-table-column>

          <el-table-column
            prop="permissions"
            label="权限"
            sortable
            width="120"
          >
            <template #default="scope">
              <div class="permission-details">
                <span
                  v-if="scope.row.canRead"
                  class="permission-badge read"
                >R</span>
                <span
                  v-if="scope.row.canWrite"
                  class="permission-badge write"
                >W</span>
                <span
                  v-if="scope.row.canExecute"
                  class="permission-badge execute"
                >X</span>
                <span
                  v-if="!scope.row.canRead && !scope.row.canWrite && !scope.row.canExecute"
                  class="text-muted"
                >-</span>
              </div>
            </template>
          </el-table-column>

          <el-table-column
            prop="modified"
            label="修改时间"
            sortable
            width="180"
          >
            <template #default="scope">
              <span class="time-text">{{ formatModifiedDate(scope.row.modified) }}</span>
            </template>
          </el-table-column>

          <el-table-column
            label="操作"
            width="72"
            fixed="right"
            align="center"
            class-name="operation-column-cell"
            label-class-name="operation-column-header"
            :resizable="false"
          >
            <template #default="scope">
              <div
                class="action-buttons"
                @click.stop
              >
                <ActionButton
                  :file="scope.row"
                  :type="scope.row.isDirectory ? 'dir' : 'file'"
                  @copy="handleCopy"
                  @move="handleMove"
                  @compress="handleCompress"
                  @decompress="handleDecompress"
                  @download="handleDownload"
                  @touch="handleTouch"
                  @delete="handleDelete"
                  @rename="handleRename"
                  @chmod="handleChmod"
                  @copy-path="handleCopyPath"
                />
              </div>
            </template>
          </el-table-column>
        </el-table>

        <!-- 空状态 -->
        <div
          v-else-if="!isLoading && visibleFiles.length === 0"
          class="empty-state"
        >
          <el-empty
            :description="emptyDescription"
            :image-size="120"
          >
            <template #image>
              <el-icon class="empty-icon">
                <Icon :icon="ICON_MAP.folder" />
              </el-icon>
            </template>
            <el-button
              type="primary"
              @click="emit('refresh')"
            >
              <el-icon><Refresh /></el-icon>
              刷新
            </el-button>
          </el-empty>
        </div>

        <!-- 加载状态 -->
        <div
          v-else-if="isLoading"
          class="loading-state"
        >
          <el-skeleton
            :rows="8"
            animated
          />
        </div>
      </div>
    </div>

    <!-- 网格视图 -->
    <div
      v-if="viewMode === 'grid'"
      class="grid-container"
    >
      <div class="grid-card-body">
        <div
          v-if="!isLoading && visibleFiles.length > 0"
          class="file-grid"
        >
          <div
            v-for="file in visibleFiles"
            :key="getFileEntryKey(file)"
            class="file-card"
            @click="emit('file-click', file)"
          >
            <div class="card-icon-wrapper">
              <el-icon
                class="card-icon"
                :class="getIconClass(file)"
              >
                <Icon :icon="getIcon(file)" />
              </el-icon>
            </div>
            <div class="card-info">
              <div
                class="card-name"
                :title="file.name"
              >
                {{ file.name }}
              </div>
              <div class="card-meta">
                <span
                  v-if="file.isSymlink"
                  class="card-symlink-badge"
                >
                  <el-icon style="font-size:10px"><Icon :icon="ICON_MAP.symlink" /></el-icon>
                  链接
                </span>
                <span v-else-if="!file.isDirectory">{{ formatFileSize(file.size) }}</span>
                <span
                  v-else
                  class="text-muted"
                >文件夹</span>
              </div>
            </div>
            <div
              class="card-actions"
              @click.stop
            >
              <ActionButton
                :file="file"
                :type="file.isDirectory ? 'dir' : 'file'"
                @copy="handleCopy"
                @move="handleMove"
                @compress="handleCompress"
                @decompress="handleDecompress"
                @download="handleDownload"
                @touch="handleTouch"
                @delete="handleDelete"
                @rename="handleRename"
                @chmod="handleChmod"
                @copy-path="handleCopyPath"
              />
            </div>
          </div>
        </div>

        <!-- 网格视图空状态 -->
        <div
          v-else-if="!isLoading && visibleFiles.length === 0"
          class="empty-state"
        >
          <el-empty
            :description="emptyDescription"
            :image-size="120"
          >
            <template #image>
              <el-icon class="empty-icon">
                <Icon :icon="ICON_MAP.folder" />
              </el-icon>
            </template>
            <el-button
              type="primary"
              @click="emit('refresh')"
            >
              <el-icon><Refresh /></el-icon>
              刷新
            </el-button>
          </el-empty>
        </div>

        <!-- 网格视图加载状态 -->
        <div
          v-else-if="isLoading"
          class="loading-state"
        >
          <el-skeleton
            :rows="8"
            animated
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { Refresh } from '@element-plus/icons-vue'
import { Icon } from '@iconify/vue'
import { icons } from '@/utils/icons.js'
import { getFileIconMeta } from '@/utils/fileIcons.js'
import { formatFileSize } from '@/utils/format.js'
import ActionButton from './ActionButton.vue'
import {
  formatFileModifiedDate,
  getFileEntryKey,
  resolveFileExtensionTagType
} from './fileTableModel.js'

defineProps({
  visibleFiles: { type: Array, default: () => [] },
  loading: Boolean,
  viewMode: { type: String, default: 'list' },
  totalCount: { type: Number, default: 0 },
  directoryCount: { type: Number, default: 0 },
  fileCount: { type: Number, default: 0 },
  emptyDescription: { type: String, default: '当前文件夹为空' }
})
const emit = defineEmits(['file-click', 'refresh', 'batch-delete', 'action'])
const entryFilter = defineModel('entryFilter', { type: String, default: 'all' })
const selectedFiles = defineModel('selectedFiles', { type: Array, default: () => [] })
const ICON_MAP = icons
const getIcon = file => getFileIconMeta(file).icon
const getIconClass = file => getFileIconMeta(file).className
const getExtensionTagType = resolveFileExtensionTagType
const formatModifiedDate = formatFileModifiedDate
const emitAction = action => file => emit('action', action, file)
const handleCopy = emitAction('copy')
const handleMove = emitAction('move')
const handleCompress = emitAction('compress')
const handleDecompress = emitAction('decompress')
const handleDownload = emitAction('download')
const handleTouch = emitAction('touch')
const handleDelete = emitAction('delete')
const handleRename = emitAction('rename')
const handleChmod = emitAction('chmod')
const handleCopyPath = emitAction('copy-path')
</script>

<style scoped>
.browser-content {
  display: contents;
}
.browser-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 38px;
  padding: 5px 10px;
  border-bottom: 1px solid var(--file-table-soft-border);
  flex-shrink: 0;
}

.batch-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  margin-bottom: 8px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--el-color-primary) 6%, var(--file-table-muted-surface));
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 18%, transparent);
  flex-shrink: 0;
}

.batch-count {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-color-primary);
  flex: 1;
}

.browser-stats,
.browser-filters {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.stat-pill,
.filter-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 26px;
  padding: 0 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.stat-pill {
  padding: 0;
  background: transparent;
  border: 0;
  color: var(--el-text-color-secondary);
}

.stat-pill + .stat-pill::before {
  content: '';
  width: 1px;
  height: 12px;
  margin-right: 8px;
  background: var(--file-table-soft-border);
}

.filter-chip {
  border: 1px solid transparent;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.filter-chip:hover,
.filter-chip.active {
  color: var(--el-color-primary);
  border-color: color-mix(in srgb, var(--el-color-primary) 18%, transparent);
  background: color-mix(in srgb, var(--el-color-primary) 7%, transparent);
}

.table-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.table-card-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.file-table {
  width: 100%;
  border: none;
  flex: 1;
  min-height: 0;
}

:deep(.el-table) {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 100%;
}

:deep(.el-table__header-wrapper) {
  flex-shrink: 0;
}

:deep(.el-table__body-wrapper) {
  flex: 1;
  min-height: 0;
  overflow-y: auto !important;
  overflow-x: hidden;
}

.grid-container {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.grid-card-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px;
}

.file-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
  gap: 10px;
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 0;
}

.file-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 10px 10px;
  position: relative;
  overflow: hidden;
  background: var(--app-card-background);
  border: 1px solid color-mix(in srgb, var(--file-table-soft-border) 90%, transparent);
  border-radius: var(--radius-container);
  box-shadow: none;
  cursor: pointer;
  transition:
    border-color 0.2s,
    box-shadow 0.2s,
    transform 0.2s,
    background-color 0.2s;
}

.file-card:hover {
  border-color: color-mix(in srgb, var(--el-border-color) 28%, transparent);
  box-shadow: none;
  transform: none;
}

.file-card:active {
  transform: none;
  box-shadow: none;
}

.card-icon-wrapper {
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
  border-radius: var(--radius-container);
  background: var(--file-table-raised-surface);
  border: 1px solid color-mix(in srgb, var(--file-table-soft-border) 88%, transparent);
  transition:
    background-color 0.2s,
    transform 0.2s;
}

.file-card:hover .card-icon-wrapper {
  background: var(--file-table-selected-surface);
  transform: scale(1.04);
}

.card-icon {
  font-size: 36px;
  transition: transform 0.2s;
}

.file-card:hover .card-icon {
  transform: scale(1.05);
}

.card-info {
  width: 100%;
  text-align: center;
  min-height: 0;
}

.card-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 3px;
  overflow: hidden;
  word-break: break-all;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.4;
  max-height: 2.8em;
}

.card-meta {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
}

.card-symlink-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: var(--el-color-primary);
  font-weight: 600;
}

.card-actions {
  position: absolute;
  top: 6px;
  right: 6px;
  opacity: 0;
  transition: opacity 0.2s;
}

.file-card:hover .card-actions {
  opacity: 1;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 18px;
  background: var(--file-table-panel-surface);
  border: 0;
  border-radius: 0;
}

.empty-icon {
  font-size: clamp(4rem, 5vw, 5rem);
  color: var(--el-text-color-placeholder);
  opacity: 0.6;
  transition: all var(--el-transition-duration) var(--el-transition-function);
}

.empty-state:hover .empty-icon {
  opacity: 1;
  transform: scale(1.05);
}

.loading-state {
  flex: 1;
  padding: 12px;
  background: var(--file-table-muted-surface);
  border-radius: 0;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  padding: 3px 6px;
  border-radius: 4px;
  transition: all var(--el-transition-duration) var(--el-transition-function);
  margin: 0 -4px;
}

.file-item:hover {
  background: color-mix(in srgb, var(--file-table-selected-surface) 84%, transparent);
  transform: none;
}

.file-icon-shell {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 4px;
  background: var(--file-table-raised-surface);
  border: 1px solid color-mix(in srgb, var(--file-table-soft-border) 88%, transparent);
}

.file-icon {
  color: var(--el-text-color-regular);
  font-size: 15px;
}

.folder-icon {
  color: var(--el-color-primary);
  font-size: 15px;
}

.image-icon,
.excel-icon {
  color: var(--el-color-success);
  font-size: 15px;
}

.video-icon,
.audio-icon,
.archive-icon {
  color: var(--el-color-warning-dark-2);
  font-size: 15px;
}

.pdf-icon,
.executable-icon {
  color: var(--el-color-danger);
  font-size: 15px;
}

.json-icon,
.code-icon {
  color: var(--el-color-primary);
  font-size: 15px;
}

.word-icon,
.ppt-icon {
  color: var(--el-color-primary);
  font-size: 15px;
}

.markdown-icon {
  color: var(--el-text-color-regular);
  font-size: 15px;
}

.text-icon {
  color: var(--el-text-color-secondary);
  font-size: 15px;
}

.font-icon,
.book-icon {
  color: var(--el-text-color-secondary);
  font-size: 15px;
}

.file-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-tags {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.symlink-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.time-text {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.text-muted {
  color: var(--el-text-color-placeholder);
}

.action-buttons {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.permission-details {
  display: flex;
  gap: 4px;
}

.permission-badge {
  width: 16px;
  height: 16px;
  border-radius: 5px;
  font-size: 9px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-secondary);
  background: var(--file-table-muted-surface);
  border: 1px solid color-mix(in srgb, var(--file-table-soft-border) 88%, transparent);
  box-shadow: none;
  transition:
    background-color 0.18s ease,
    color 0.18s ease;
}

.permission-badge:hover {
  color: var(--el-text-color-primary);
  background: var(--file-table-selected-surface);
}

.permission-badge.read {
  color: var(--el-color-primary);
  background-color: color-mix(in srgb, var(--el-color-primary) 9%, var(--file-table-muted-surface));
  border-color: color-mix(in srgb, var(--el-color-primary) 20%, transparent);
}

.permission-badge.write {
  color: var(--el-color-warning-dark-2);
  background-color: color-mix(in srgb, var(--el-color-warning) 11%, var(--file-table-muted-surface));
  border-color: color-mix(in srgb, var(--el-color-warning) 24%, transparent);
}

.permission-badge.execute {
  color: var(--el-color-success-dark-2);
  background-color: color-mix(in srgb, var(--el-color-success) 11%, var(--file-table-muted-surface));
  border-color: color-mix(in srgb, var(--el-color-success) 24%, transparent);
}

:deep(.file-table-header),
:deep(.el-table__header th) {
  background: var(--file-table-muted-surface) !important;
  border-bottom: 1px solid color-mix(in srgb, var(--file-table-soft-border) 88%, transparent) !important;
}

:deep(.el-table__header th) {
  color: var(--el-text-color-regular) !important;
  font-weight: 600 !important;
  font-size: 12px !important;
  letter-spacing: 0.2px;
}

:deep(.el-table__body tr) {
  transition: all var(--el-transition-duration) var(--el-transition-function);
}

:deep(.el-table__body tr:hover) {
  background-color: color-mix(
    in srgb,
    var(--file-table-selected-surface) 72%,
    transparent
  ) !important;
}

:deep(.el-table__body tr.current-row) {
  background-color: var(--file-table-selected-surface) !important;
}

:deep(.el-table__body td) {
  padding: 10px 0 !important;
  font-size: 12px !important;
  color: var(--el-text-color-primary) !important;
  border-bottom: 1px solid color-mix(in srgb, var(--file-table-soft-border) 58%, transparent) !important;
}

:deep(.operation-column-header),
:deep(.operation-column-cell) {
  background: var(--app-card-background) !important;
  border-left: 1px solid color-mix(in srgb, var(--file-table-soft-border) 76%, transparent) !important;
  box-shadow: -8px 0 16px color-mix(in srgb, var(--el-text-color-primary) 3%, transparent);
}

:deep(.operation-column-header) {
  color: var(--el-text-color-secondary) !important;
  font-weight: 600 !important;
}

:deep(.el-table__body tr:hover .operation-column-cell),
:deep(.el-table__body tr.current-row .operation-column-cell) {
  background: color-mix(in srgb, var(--file-table-selected-surface) 72%, var(--app-card-background)) !important;
}

:deep(.el-table--striped .el-table__body tr.el-table__row--striped td) {
  background-color: color-mix(in srgb, var(--file-table-muted-surface) 64%, transparent) !important;
}

:deep(.el-table__inner-wrapper::before) {
  display: none;
}

:deep(.el-tag) {
  --el-tag-bg-color: var(--file-table-muted-surface);
  --el-tag-border-color: transparent;
  --el-tag-text-color: var(--el-text-color-regular);
  border-radius: 999px;
  border-color: transparent;
  font-size: 10px;
  font-weight: 600;
  height: 20px;
  line-height: 18px;
}

:deep(.el-tag--primary) {
  --el-tag-bg-color: color-mix(in srgb, var(--el-color-primary) 9%, var(--file-table-muted-surface));
  --el-tag-border-color: color-mix(in srgb, var(--el-color-primary) 20%, transparent);
  --el-tag-text-color: var(--el-color-primary);
}

:deep(.el-tag--success) {
  --el-tag-bg-color: color-mix(in srgb, var(--el-color-success) 10%, var(--file-table-muted-surface));
  --el-tag-border-color: color-mix(in srgb, var(--el-color-success) 22%, transparent);
  --el-tag-text-color: var(--el-color-success-dark-2);
}

:deep(.el-tag--warning) {
  --el-tag-bg-color: color-mix(in srgb, var(--el-color-warning) 11%, var(--file-table-muted-surface));
  --el-tag-border-color: color-mix(in srgb, var(--el-color-warning) 24%, transparent);
  --el-tag-text-color: var(--el-color-warning-dark-2);
}

:deep(.el-tag--danger) {
  --el-tag-bg-color: color-mix(in srgb, var(--el-color-danger) 9%, var(--file-table-muted-surface));
  --el-tag-border-color: color-mix(in srgb, var(--el-color-danger) 22%, transparent);
  --el-tag-text-color: var(--el-color-danger);
}

:deep(.el-tag--info) {
  --el-tag-bg-color: color-mix(in srgb, var(--el-color-info) 9%, var(--file-table-muted-surface));
  --el-tag-border-color: color-mix(in srgb, var(--el-color-info) 18%, transparent);
  --el-tag-text-color: var(--el-text-color-regular);
}

@media (max-width: 768px) {
  .browser-toolbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .file-name {
    font-size: 13px;
  }

  .time-text {
    font-size: 12px;
  }

  .file-tags {
    flex-direction: column;
    gap: 2px;
  }
}
</style>
