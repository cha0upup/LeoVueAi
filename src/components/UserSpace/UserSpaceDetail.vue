<template>
  <section class="detail-card">
    <div
      v-if="loading"
      class="detail-loading"
    >
      <el-skeleton
        :rows="9"
        animated
      />
    </div>
    <template v-else-if="entry">
      <header class="detail-topbar">
        <div class="identity-block">
          <div class="identity-title">
            <el-icon><Icon :icon="entryIcon" /></el-icon>
            <h2 :title="title">
              {{ title }}
            </h2>
          </div>
          <p :title="entry.path">
            {{ entry.path }}
          </p>
        </div>
        <div class="detail-actions">
          <el-button
            type="primary"
            @click="emit('preview', entry)"
          >
            <el-icon><Icon :icon="iconMap.view" /></el-icon>
            预览
          </el-button>
          <el-button @click="emit('download', entry)">
            <el-icon><Icon :icon="iconMap.download" /></el-icon>
            下载
          </el-button>
          <el-dropdown
            trigger="click"
            @command="emit('delete', entry)"
          >
            <el-button
              class="more-btn"
              aria-label="更多成果操作"
            >
              <el-icon><Icon :icon="iconMap.more" /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  command="delete"
                  class="danger-item"
                >
                  <el-icon><Icon :icon="iconMap.delete" /></el-icon>
                  删除成果
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>
      <div class="meta-strip">
        <el-tag
          size="small"
          type="info"
          effect="plain"
          class="workbench-type-tag"
        >
          {{ resolveArtifactCategoryLabel(entry.category) }}
        </el-tag>
        <span>{{ resolveArtifactSourceLabel(entry.metadata?.sourceModule) }}</span>
        <span>{{ formatFileSize(entry.size) }}</span>
      </div>
      <div class="overview-grid">
        <article class="panel">
          <h3 class="panel-header">
            文件信息
          </h3>
          <dl class="meta-list">
            <div><dt>文件名</dt><dd>{{ entry.name }}</dd></div>
            <div><dt>文件类型</dt><dd>{{ getUserSpaceFileExtension(entry.name).toUpperCase() || '未知类型' }}</dd></div>
            <div><dt>文件大小</dt><dd>{{ formatFileSize(entry.size) }}</dd></div>
            <div><dt>更新时间</dt><dd>{{ formatDate(entry.lastModified) }}</dd></div>
          </dl>
        </article>
        <article class="panel">
          <h3 class="panel-header">
            来源信息
          </h3>
          <dl class="meta-list">
            <div><dt>来源模块</dt><dd>{{ resolveArtifactSourceLabel(entry.metadata?.sourceModule) }}</dd></div>
            <div><dt>归档时间</dt><dd>{{ formatDate(entry.metadata?.createdAt) }}</dd></div>
            <div v-if="entry.metadata?.hostName">
              <dt>关联主机</dt><dd>{{ entry.metadata.hostName }}</dd>
            </div>
            <div v-if="entry.metadata?.sourceId">
              <dt>来源标识</dt><dd><code>{{ entry.metadata.sourceId }}</code></dd>
            </div>
            <div v-if="entry.metadata?.sessionId">
              <dt>关联会话</dt><dd><code>{{ entry.metadata.sessionId }}</code></dd>
            </div>
          </dl>
          <p
            v-if="!entry.metadata?.sourceModule"
            class="source-note"
          >
            此文件未记录来源信息，后续归档会自动记录。
          </p>
        </article>
        <article class="panel path-panel">
          <h3 class="panel-header">
            存储路径
          </h3>
          <code class="storage-path">{{ entry.path }}</code>
        </article>
      </div>
    </template>
    <EmptyState
      v-else
      workbench
      title="选择一份成果"
      description="左侧支持分类、来源筛选和搜索，选择成果后查看详情、预览或下载。"
      :icon="iconMap.folderOpened"
    />
  </section>
</template>

<script setup>
import { computed } from 'vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { icons as iconMap } from '@/utils/icons.js'
import { formatDate, formatFileSize } from '@/utils/format.js'
import { getUserSpaceEntryIconKey, getUserSpaceFileExtension, resolveArtifactCategoryLabel, resolveArtifactSourceLabel } from './userSpaceModel.js'

const props = defineProps({
  entry: { type: Object, default: null },
  loading: { type: Boolean, default: false }
})
const emit = defineEmits(['preview', 'download', 'delete'])
const title = computed(() => props.entry?.metadata?.title || props.entry?.name || '')
const entryIcon = computed(() => iconMap[getUserSpaceEntryIconKey(props.entry)] || iconMap.file)
</script>

<style scoped>
@import '@/styles/workbench-toolbar-shared.css';
@import '@/styles/workbench-detail-actions-shared.css';

.detail-card {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--app-container-background);
  container-type: inline-size;
}
.detail-loading {
  padding: 24px;
}
.detail-topbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 0 0 14px;
  border-bottom: 1px solid var(--app-divider-color);
}
.identity-block {
  min-width: 0;
  flex: 1;
}
.identity-title {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.identity-title .el-icon {
  flex-shrink: 0;
  margin-top: 2px;
  font-size: 18px;
  color: var(--el-color-primary);
}
.identity-title h2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
  margin: 0;
  font-size: var(--font-size-page-title);
  line-height: 1.4;
}
.identity-block p {
  margin: 8px 0 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.meta-strip {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 14px;
  padding: 12px 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.overview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
  gap: 12px;
  padding: 0 0 18px;
}
.panel {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--app-divider-color);
  border-radius: var(--radius-container);
}
.panel-header {
  margin: 0;
  padding: 12px;
  border-bottom: 1px solid var(--app-divider-color);
  font-size: 13px;
  font-weight: 600;
}
.meta-list {
  margin: 0;
  padding: 4px 12px;
}
.meta-list div {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--app-divider-color);
  font-size: 12px;
  line-height: 1.6;
}
.meta-list div:last-child {
  border-bottom: 0;
}
.meta-list dt {
  color: var(--el-text-color-secondary);
}
.meta-list dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
}
.meta-list code,
.storage-path {
  font-family: var(--el-font-family-mono);
  font-size: 12px;
}
.source-note {
  margin: 0;
  padding: 0 12px 12px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.7;
}
.path-panel {
  grid-column: 1 / -1;
}
.storage-path {
  display: block;
  padding: 12px;
  overflow-wrap: anywhere;
  line-height: 1.7;
}
@container (max-width: 600px) {
  .detail-topbar {
    flex-direction: column;
    gap: 12px;
  }
  .detail-actions {
    justify-content: flex-start;
  }
  .overview-grid {
    grid-template-columns: 1fr;
  }
}
</style>
