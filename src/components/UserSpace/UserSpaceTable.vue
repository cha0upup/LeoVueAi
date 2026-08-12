<template>
  <aside class="inspector-panel">
    <header class="inspector-header">
      <div><span>ARTIFACT DETAIL</span><strong>成果详情</strong></div>
      <small>{{ selectedEntry ? '已选择' : '等待选择' }}</small>
    </header>
    <section
      v-if="selectedEntry"
      class="inspector-content"
    >
      <div class="identity-card">
        <span
          class="identity-icon"
          :class="{ 'is-dir': selectedEntry.isDirectory }"
        >
          <el-icon><Icon :icon="resolveEntryIcon(selectedEntry)" /></el-icon>
        </span>
        <div class="identity-copy">
          <h2>{{ selectedEntry.name }}</h2>
          <el-tag
            :type="selectedEntry.isDirectory ? 'success' : 'info'"
            effect="light"
            class="detail-kind-tag workbench-type-tag"
          >
            {{
              selectedEntry.isDirectory ? '目录' : getFileExtension(selectedEntry.name) || '文件'
            }}
          </el-tag>
        </div>
      </div>

      <div class="primary-actions">
        <el-button
          v-if="selectedEntry.isDirectory"
          type="primary"
          @click="emitEnterDirectory(selectedEntry)"
        >
          <el-icon><Icon :icon="iconMap.folderOpened" /></el-icon>
          打开
        </el-button>
        <el-button
          v-else
          type="primary"
          @click="emitPreviewFile(selectedEntry)"
        >
          <el-icon><Icon :icon="iconMap.view" /></el-icon>
          预览
        </el-button>
        <el-button
          v-if="!selectedEntry.isDirectory"
          @click="emitDownloadFile(selectedEntry)"
        >
          <el-icon><Icon :icon="iconMap.download" /></el-icon>
          下载
        </el-button>
        <el-button
          type="danger"
          plain
          @click="emitDeleteEntry(selectedEntry)"
        >
          <el-icon><Icon :icon="iconMap.delete" /></el-icon>
          删除
        </el-button>
      </div>

      <dl class="meta-list">
        <div>
          <dt>路径</dt>
          <dd class="path-value">
            {{ selectedEntry.path }}
          </dd>
        </div>
        <div>
          <dt>大小</dt>
          <dd>{{ selectedEntry.isDirectory ? '-' : formatFileSize(selectedEntry.size) }}</dd>
        </div>
        <div>
          <dt>更新时间</dt>
          <dd>{{ formatTimestamp(selectedEntry.lastModified) }}</dd>
        </div>
        <div>
          <dt>扩展名</dt>
          <dd>
            {{ selectedEntry.isDirectory ? '-' : getFileExtension(selectedEntry.name) || '-' }}
          </dd>
        </div>
      </dl>
    </section>

    <section
      v-else
      class="inspector-empty"
    >
      <div class="empty-compact">
        <span class="empty-icon"><el-icon><Icon :icon="iconMap.info" /></el-icon></span>
        <strong>选择一份成果</strong>
        <span>在左侧列表中选择文件或目录，查看详情与可用操作。</span>
      </div>
    </section>
  </aside>
</template>

<script setup>
import { icons } from '@/utils/icons.js'
import { formatFileSize, formatDate } from '@/utils/format.js'
import { getUserSpaceEntryIconKey, getUserSpaceFileExtension } from './userSpaceModel.js'

const iconMap = icons

defineProps({
  selectedEntry: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['enter-directory', 'preview-file', 'download-file', 'delete-entry'])

const formatTimestamp = (value) => formatDate(value)

const getFileExtension = (path) => getUserSpaceFileExtension(path)
const resolveEntryIcon = (row) => iconMap[getUserSpaceEntryIconKey(row)] || iconMap.file

// Emit methods
const emitEnterDirectory = (row) => emit('enter-directory', row)
const emitPreviewFile = (row) => emit('preview-file', row)
const emitDownloadFile = (row) => emit('download-file', row)
const emitDeleteEntry = (row) => emit('delete-entry', row)
</script>

<style scoped>
@import '@/styles/workbench-toolbar-shared.css';

.inspector-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
  min-height: 0;
  align-self: stretch;
  border-radius: var(--radius-container);
  border: 1px solid var(--workspace-border-soft);
  background: var(--el-bg-color-overlay);
  overflow: hidden;
}

.inspector-header {
  min-height: 54px;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border-bottom: 1px solid var(--workspace-border-soft);
  background: var(--app-container-background);
}

.inspector-header div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.inspector-header span {
  color: var(--el-text-color-placeholder);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.08em;
}
.inspector-header strong {
  font-size: 13px;
}
.inspector-header small {
  color: var(--el-text-color-secondary);
  font-size: 10px;
}

.inspector-content {
  max-height: 100%;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: auto;
}

.identity-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: var(--radius-container);
  border: 1px solid var(--workspace-border-soft);
  background: var(--app-container-background);
}

.identity-icon {
  width: 38px;
  height: 38px;
  border-radius: var(--radius-control);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 20px;
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 12%, var(--app-control-background));
}

.identity-icon.is-dir {
  color: var(--el-color-success);
  background: color-mix(in srgb, var(--el-color-success) 14%, var(--app-control-background));
}

.identity-copy {
  min-width: 0;
}

.identity-copy h2 {
  margin: 0 0 6px;
  font-size: 15px;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.primary-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.primary-actions :deep(.el-button) {
  flex: 1 1 auto;
  height: 30px;
  margin: 0;
  border-radius: 6px;
  font-size: 12px;
}

.meta-list {
  margin: 0;
  display: flex;
  flex-direction: column;
  border-top: 1px solid color-mix(in srgb, var(--el-border-color) 22%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 22%, transparent);
}

.meta-list div {
  display: grid;
  grid-template-columns: 70px minmax(0, 1fr);
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
}

.meta-list div:last-child {
  border-bottom: none;
}

.meta-list dt {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.meta-list dd {
  margin: 0;
  font-size: 12px;
  color: var(--el-text-color-primary);
  word-break: break-word;
  text-align: right;
  min-width: 0;
}

.path-value {
  font-family: var(--el-font-family-mono);
}

.inspector-empty {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-compact {
  max-width: 210px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
  line-height: 1.55;
  text-align: center;
}

.empty-compact strong {
  color: var(--el-text-color-primary);
  font-size: 13px;
}
.empty-icon {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-control);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 10%, var(--app-control-background));
  font-size: 17px;
}

@media (max-width: 768px) {
  .inspector-panel {
    min-height: 280px;
  }
}
</style>
