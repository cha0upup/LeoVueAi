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

    <div
      v-else-if="plugin"
      class="detail-content"
    >
      <div class="detail-topbar">
        <div class="identity-block">
          <div class="identity-title">
            <el-icon class="identity-icon">
              <Icon :icon="iconMap.plugin" />
            </el-icon>
            <h2>{{ plugin.pluginName || plugin.pluginId }}</h2>
            <el-tag
              type="primary"
              effect="light"
              class="plugin-type-tag workbench-type-tag"
            >
              {{
                plugin.pluginType || 'unknown'
              }}
            </el-tag>
            <el-tag
              type="info"
              effect="plain"
            >
              v{{ plugin.version || '-' }}
            </el-tag>
          </div>
          <p>{{ plugin.pluginDescription || '未填写插件描述。' }}</p>
          <div class="identity-id">
            <span>Plugin ID</span>
            <code>{{ plugin.pluginId }}</code>
          </div>
        </div>

        <div class="detail-actions">
          <el-button
            :loading="exporting"
            @click="$emit('export', plugin)"
          >
            <el-icon><Icon :icon="iconMap.download" /></el-icon>
            导出
          </el-button>
          <el-button
            v-if="canManage"
            type="primary"
            plain
            @click="$emit('edit', plugin)"
          >
            <el-icon><Icon :icon="iconMap.edit" /></el-icon>
            编辑
          </el-button>
          <el-dropdown
            v-if="canManage"
            trigger="click"
            @command="handleActionCommand"
          >
            <el-button
              class="more-btn"
              aria-label="更多插件操作"
            >
              <el-icon><Icon :icon="iconMap.more" /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  command="delete"
                  :disabled="deleting"
                  divided
                  class="danger-item"
                >
                  <el-icon><Icon :icon="iconMap.delete" /></el-icon>
                  删除
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>

      <div class="meta-strip">
        <span>创建用户 {{ plugin.createUserId || '-' }}</span>
        <span>创建 {{ formatTime(plugin.createTime) }}</span>
      </div>

      <div class="overview-grid">
        <article class="panel params-panel">
          <div class="panel-header panel-header-with-actions">
            <span>参数模板</span>
            <button
              type="button"
              class="panel-tool-btn"
              :disabled="!plugin.paramsDemo"
              title="复制参数模板"
              @click="copyText(plugin.paramsDemo, '参数模板已复制')"
            >
              <el-icon><Icon :icon="iconMap.copy" /></el-icon>
            </button>
          </div>
          <div class="kv-list single-column">
            <div class="params-box">
              <pre class="plain-pre">{{ plugin.paramsDemo || '暂无参数模板' }}</pre>
            </div>
            <div class="kv-item">
              <label>备注</label>
              <span>{{ plugin.remark || '暂无备注' }}</span>
            </div>
          </div>
        </article>
      </div>
    </div>

    <div
      v-else
      class="detail-empty"
    >
      <EmptyState
        workbench
        title="选择一个插件"
        description="左侧列表支持搜索和类型筛选，右侧展示插件元信息与参数模板。"
        :icon="iconMap.plugin"
      />
    </div>
  </section>
</template>

<script setup>
import EmptyState from '@/components/common/EmptyState.vue'
import { icons as iconMap } from '@/utils/icons.js'
import { formatDate as formatTime } from '@/utils/format.js'
import { copyTextWithFeedback } from '@/utils/clipboard.js'

const props = defineProps({
  plugin: {
    type: Object,
    default: null
  },
  loading: {
    type: Boolean,
    default: false
  },
  deleting: {
    type: Boolean,
    default: false
  },
  exporting: {
    type: Boolean,
    default: false
  },
  canManage: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['edit', 'delete', 'export'])

function handleActionCommand(command) {
  if (command === 'delete') {
    emit('delete', props.plugin)
  }
}

function copyText(text, successMessage) {
  if (!text) return
  return copyTextWithFeedback(text, successMessage)
}
</script>

<style scoped>
@import '@/styles/workbench-toolbar-shared.css';
@import '@/styles/workbench-detail-actions-shared.css';
@import '@/styles/detail-card-shared.css';

.detail-card {
  border: 1px solid
    var(--detail-border-soft, color-mix(in srgb, var(--el-border-color) 42%, transparent));
  --workbench-surface-muted: var(--detail-surface-muted);
  --workbench-border-soft: var(--detail-border-soft);
}

.meta-strip span + span::before {
  content: '';
  position: absolute;
  left: -8px;
  top: 50%;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--el-text-color-secondary) 42%, transparent);
}

.overview-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-3);
  padding: 0 var(--space-4) var(--space-4);
}

.panel-header {
  min-height: 40px;
  display: flex;
  align-items: center;
  padding: 10px 12px;
}

.params-box {
  min-height: 96px;
  padding: 12px 14px;
  overflow: auto;
  border-radius: var(--radius-control);
  border: 1px solid color-mix(in srgb, var(--el-border-color) 28%, transparent);
  background: color-mix(in srgb, var(--detail-surface-muted) 86%, var(--el-bg-color-overlay));
}

.plain-pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  line-height: 1.7;
  font-family: var(--el-font-family-mono);
  color: var(--el-text-color-primary);
}

@media (max-width: 768px) {
  .detail-topbar {
    padding: 14px;
  }

  .overview-grid,
  .meta-strip {
    padding-left: 12px;
    padding-right: 12px;
  }
}
</style>
