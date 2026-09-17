<template>
  <div
    ref="browserRef"
    class="browser-content"
    :aria-busy="loading"
  >
    <div class="browser-toolbar">
      <div
        class="browser-filters"
        aria-label="文件类型筛选"
      >
        <button
          v-for="filter in filters"
          :key="filter.value"
          type="button"
          class="filter-chip"
          :class="{ active: entryFilter === filter.value }"
          :aria-pressed="entryFilter === filter.value"
          @click="entryFilter = filter.value"
        >
          {{ filter.label }} <span>{{ filter.count }}</span>
        </button>
      </div>
      <span
        v-if="!loading && searchActive"
        class="match-count"
        role="status"
      >匹配 {{ visibleFiles.length }} /
        {{ filters.find((filter) => filter.value === entryFilter)?.count || 0 }} 项</span>
    </div>
    <div
      v-if="loading"
      class="loading-state"
      role="status"
      aria-label="正在加载文件"
    >
      <el-skeleton
        :rows="8"
        animated
      />
    </div>
    <el-empty
      v-else-if="!visibleFiles.length"
      :description="emptyDescription"
      :image-size="80"
      class="empty-state"
    >
      <el-button
        size="small"
        @click="emit('refresh')"
      >
        刷新
      </el-button>
    </el-empty>
    <template v-else-if="viewMode === 'list'">
      <div
        v-if="selectedFiles.length"
        class="batch-toolbar"
      >
        <span>已选 {{ selectedFiles.length }} 项</span>
        <el-button
          text
          size="small"
          type="danger"
          @click="emit('batch-delete')"
        >
          删除所选
        </el-button>
        <el-button
          text
          size="small"
          @click="clearSelection"
        >
          取消选择
        </el-button>
      </div>
      <el-table
        ref="tableRef"
        :data="visibleFiles"
        :row-key="getFileEntryKey"
        height="100%"
        size="small"
        class="file-table"
        @selection-change="selectedFiles = $event"
      >
        <el-table-column
          type="selection"
          width="36"
        />
        <el-table-column
          prop="name"
          :label="compact ? '名称 / 修改时间' : '名称'"
          sortable
          min-width="160"
        >
          <template #default="{ row }">
            <div class="file-item">
              <Icon
                class="file-icon"
                :class="getIconClass(row)"
                :icon="getIcon(row)"
              />
              <div class="file-identity">
                <button
                  type="button"
                  class="file-name"
                  :title="row.name"
                  @click="emit('file-click', row)"
                >
                  {{ row.name }}
                </button>
                <div
                  v-if="compact"
                  class="file-secondary"
                >
                  <time :title="formatFileModifiedDate(row.modified)">{{
                    shortDate(row.modified)
                  }}</time><span :title="permissionLabel(row)">{{ permissionText(row) }}</span>
                </div>
              </div>
              <span
                v-if="row.isSymlink"
                class="symlink-tag"
                :title="row.symlinkTarget ? `符号链接 → ${row.symlinkTarget}` : '符号链接'"
              ><Icon :icon="icons.symlink" /> 链接</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          prop="size"
          label="大小"
          sortable
          width="84"
        >
          <template #default="{ row }">
            <span class="file-size">{{
              row.isDirectory ? '—' : formatFileSize(row.size)
            }}</span>
          </template>
        </el-table-column>
        <el-table-column
          v-if="!compact"
          label="访问"
          width="76"
        >
          <template #default="{ row }">
            <span
              class="permission-text"
              :title="permissionLabel(row)"
              :aria-label="permissionLabel(row)"
            >{{ permissionText(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column
          v-if="!compact"
          prop="modified"
          label="修改时间"
          sortable
          width="150"
        >
          <template #default="{ row }">
            <time
              class="time-text"
              :title="formatFileModifiedDate(row.modified)"
            >{{
              shortDate(row.modified)
            }}</time>
          </template>
        </el-table-column>
        <el-table-column
          label="操作"
          width="80"
          align="center"
        >
          <template #default="{ row }">
            <ActionButton
              :file="row"
              :type="row.isDirectory ? 'dir' : 'file'"
              @action="forwardAction"
            />
          </template>
        </el-table-column>
      </el-table>
    </template>
    <div
      v-else
      class="grid-container"
    >
      <div class="file-grid">
        <div
          v-for="file in visibleFiles"
          :key="getFileEntryKey(file)"
          class="file-card"
        >
          <button
            type="button"
            class="card-open"
            :title="file.name"
            @click="emit('file-click', file)"
          >
            <Icon
              class="card-icon"
              :class="getIconClass(file)"
              :icon="getIcon(file)"
            />
            <span class="card-name">{{ file.name }}</span>
            <span class="card-meta">{{
              file.isSymlink ? '符号链接' : file.isDirectory ? '' : formatFileSize(file.size)
            }}</span>
          </button>
          <div class="card-actions">
            <ActionButton
              :file="file"
              :type="file.isDirectory ? 'dir' : 'file'"
              @action="forwardAction"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { icons } from '@/utils/icons.js'
import { getFileIconMeta } from '@/utils/fileIcons.js'
import { formatFileSize } from '@/utils/format.js'
import ActionButton from './ActionButton.vue'
import { formatFileModifiedDate, getFileEntryKey } from './fileTableModel.js'

const props = defineProps({
  visibleFiles: { type: Array, default: () => [] },
  loading: Boolean,
  searchActive: Boolean,
  viewMode: { type: String, default: 'list' },
  totalCount: { type: Number, default: 0 },
  directoryCount: { type: Number, default: 0 },
  fileCount: { type: Number, default: 0 },
  emptyDescription: { type: String, default: '当前文件夹为空' }
})
const emit = defineEmits(['file-click', 'refresh', 'batch-delete', 'action'])
const entryFilter = defineModel('entryFilter', { type: String, default: 'all' })
const selectedFiles = defineModel('selectedFiles', { type: Array, default: () => [] })
const tableRef = ref(null)
const browserRef = ref(null)
const compact = ref(false)
let resizeObserver
const filters = computed(() => [
  { value: 'all', label: '全部', count: props.totalCount },
  { value: 'dir', label: '文件夹', count: props.directoryCount },
  { value: 'file', label: '文件', count: props.fileCount }
])
const getIcon = (file) => getFileIconMeta(file).icon
const getIconClass = (file) => getFileIconMeta(file).className
const shortDate = (value) => formatFileModifiedDate(value).slice(0, 16)
const permissionText = (file) =>
  `${file.canRead ? 'r' : '-'}${file.canWrite ? 'w' : '-'}${file.canExecute ? 'x' : '-'}`
const permissionLabel = (file) =>
  `当前进程：${file.canRead ? '可读' : '不可读'}、${file.canWrite ? '可写' : '不可写'}、${file.canExecute ? '可执行' : '不可执行'}`
const forwardAction = (action, file) => emit('action', action, file)
const clearSelection = () => {
  tableRef.value?.clearSelection()
  selectedFiles.value = []
}
watch(selectedFiles, (files) => {
  if (!files.length) tableRef.value?.clearSelection()
})
onMounted(() => {
  resizeObserver = new ResizeObserver(([entry]) => {
    compact.value = entry.contentRect.width < 610
  })
  resizeObserver.observe(browserRef.value)
})
onBeforeUnmount(() => resizeObserver?.disconnect())
</script>

<style scoped>
.browser-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  min-width: 0;
}
.browser-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 4px 10px 8px;
  flex-shrink: 0;
}
.browser-filters {
  display: flex;
  gap: 4px;
}
.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  font-size: 12px;
}
.filter-chip span {
  font-variant-numeric: tabular-nums;
}
.filter-chip:hover,
.filter-chip.active {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.filter-chip:focus-visible,
.file-name:focus-visible,
.card-open:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: -2px;
}
.match-count {
  margin-left: auto;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.batch-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding: 4px 10px;
  font-size: 12px;
  background: var(--el-color-primary-light-9);
}
.batch-toolbar span {
  margin-right: auto;
}
.batch-toolbar :deep(.el-button + .el-button) {
  margin-left: 0;
}
.file-table {
  flex: 1;
  min-height: 0;
  width: 100%;
  --el-table-header-bg-color: var(--app-control-background-soft);
}
.file-table :deep(td.el-table__cell) {
  padding: 5px 0;
}
.file-table :deep(.cell) {
  padding: 0 8px;
}
.file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.file-icon {
  flex-shrink: 0;
  font-size: 18px;
}
.file-identity {
  flex: 1;
  min-width: 0;
}
.file-name {
  display: block;
  max-width: 100%;
  border: 0;
  padding: 3px 0;
  background: transparent;
  color: var(--el-text-color-primary);
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
  font-size: 13px;
}
.file-name:hover {
  color: var(--el-color-primary);
}
.file-secondary {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.symlink-tag {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  color: var(--el-text-color-secondary);
  font-size: 11px;
}
.permission-text {
  font-family: var(--app-font-mono, monospace);
  color: var(--el-text-color-secondary);
}
.time-text,
.file-size {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}
.loading-state {
  padding: 16px;
}
.empty-state {
  flex: 1;
  min-height: 0;
}
.grid-container {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 4px 10px 10px;
}
.file-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(125px, 1fr));
  gap: 8px;
}
.file-card {
  position: relative;
  min-width: 0;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}
.file-card:hover {
  background: var(--app-control-background-soft);
}
.card-open {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  height: 100%;
  gap: 8px;
  padding: 18px 12px 12px;
  border: 0;
  border-radius: inherit;
  background: transparent;
  cursor: pointer;
  color: var(--el-text-color-primary);
}
.card-icon {
  font-size: 32px;
}
.card-name {
  font-size: 12px;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.5;
}
.card-meta {
  min-height: 15px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.card-actions {
  position: absolute;
  top: 4px;
  right: 4px;
  opacity: 0;
}
.file-card:hover .card-actions,
.file-card:focus-within .card-actions {
  opacity: 1;
}
.folder-icon,
.code-icon,
.json-icon,
.word-icon,
.ppt-icon {
  color: var(--el-color-primary);
}
.image-icon,
.excel-icon {
  color: var(--el-color-success);
}
.video-icon,
.audio-icon,
.archive-icon {
  color: var(--el-color-warning);
}
.pdf-icon,
.executable-icon {
  color: var(--el-color-danger);
}
@media (hover: none) {
  .card-actions {
    opacity: 1;
  }
}
</style>
