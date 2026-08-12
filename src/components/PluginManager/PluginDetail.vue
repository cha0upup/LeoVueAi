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
        <span>{{ pluginTypeLabel }}</span>
        <span>v{{ plugin.version || '-' }}</span>
        <span>{{ plugin.createUserId || '-' }}</span>
        <span>创建 {{ formatTime(plugin.createTime) }}</span>
      </div>

      <div class="overview-grid">
        <article class="panel meta-panel">
          <div class="panel-header">
            元数据
          </div>
          <div class="kv-list">
            <div class="kv-item">
              <label>Plugin ID</label>
              <code>{{ plugin.pluginId }}</code>
            </div>
            <div class="kv-item">
              <label>插件名称</label>
              <span>{{ plugin.pluginName || '-' }}</span>
            </div>
            <div class="kv-item">
              <label>插件类型</label>
              <span>{{ plugin.pluginType || '-' }}</span>
            </div>
            <div class="kv-item">
              <label>版本号</label>
              <span>{{ plugin.version || '-' }}</span>
            </div>
          </div>
        </article>

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
import { computed } from 'vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { icons } from '@/utils/icons.js'
import { formatDate } from '@/utils/format.js'
import { showError, showSuccess } from '@/utils/messageUtils.js'

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

const iconMap = icons
const pluginTypeLabel = computed(() => {
  const type = props.plugin?.pluginType
  return {
    java: 'Java',
    javaScript: 'JavaScript',
    shellCode: 'Shell'
  }[type] || type || '-'
})

function handleActionCommand(command) {
  if (command === 'delete') {
    emit('delete', props.plugin)
  }
}

async function copyText(text, successMessage) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    showSuccess(successMessage)
  } catch {
    try {
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      showSuccess(successMessage)
    } catch {
      showError('复制失败，请手动复制')
    }
  }
}

function formatTime(timestamp) {
  return timestamp ? formatDate(timestamp) : '-'
}
</script>

<style scoped>
@import '@/styles/workbench-toolbar-shared.css';
@import '@/styles/detail-card-shared.css';
@import '@/styles/workbench-detail-actions-shared.css';

.detail-card {
  height: 100%;
  min-height: 0;
  border-radius: var(--radius-container);
  border: 1px solid
    var(--detail-border-soft, color-mix(in srgb, var(--el-border-color) 42%, transparent));
  background: var(--app-container-background);
  overflow: auto;
  --detail-surface-raised: color-mix(
    in srgb,
    var(--app-control-background-soft) 88%,
    var(--el-bg-color-overlay)
  );
  --detail-surface-raised-strong: color-mix(
    in srgb,
    var(--app-control-background-hover) 92%,
    var(--el-bg-color-overlay)
  );
  --detail-surface-muted: color-mix(
    in srgb,
    var(--app-control-background) 94%,
    var(--el-bg-color-overlay)
  );
  --detail-border-soft: color-mix(in srgb, var(--el-border-color) 42%, transparent);
  --workbench-surface-muted: var(--detail-surface-muted);
  --workbench-border-soft: var(--detail-border-soft);
  --detail-card-surface-raised: var(--detail-surface-raised);
  --detail-card-surface-muted: var(--detail-surface-muted);
  --detail-card-border-soft: var(--detail-border-soft);
}

.detail-loading,
.detail-empty {
  padding: 24px;
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0;
}

.detail-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px 14px;
  background: var(--app-container-background);
  border-bottom: 1px solid var(--detail-border-soft);
}

.identity-block {
  min-width: 0;
  flex: 1 1 auto;
}

.identity-title {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.identity-icon {
  font-size: 18px;
  color: var(--el-color-primary);
}

.identity-title h2 {
  margin: 0;
  font-size: var(--font-size-page-title);
  line-height: 1.15;
}

.identity-block p {
  margin: 0 0 12px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.identity-id {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 9px;
  border-radius: var(--radius-control);
  background: var(--detail-surface-muted);
  border: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
}

.identity-id span {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.identity-id code {
  font-family: var(--el-font-family-mono);
  font-size: 12px;
}

.meta-strip {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 14px;
  padding: 0 18px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.meta-strip span {
  position: relative;
  line-height: 1.5;
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
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding: 0 18px 18px;
}

.panel {
  border-radius: var(--radius-container);
  border: 1px solid var(--detail-border-soft);
  background: var(--app-container-background);
}

.panel-header {
  min-height: 42px;
  display: flex;
  align-items: center;
  padding: 10px 12px;
  font-size: 13px;
}

.panel-header-with-actions {
  justify-content: space-between;
  gap: 10px;
}

.panel-tool-btn {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 42%, transparent);
  border-radius: 6px;
  background: var(--detail-surface-muted);
  color: var(--el-text-color-secondary);
  cursor: pointer;
}

.panel-tool-btn:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--el-color-primary) 42%, transparent);
  color: var(--el-color-primary);
}

.panel-tool-btn:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.single-column {
  grid-template-columns: 1fr;
}

.kv-list {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 12px;
}

.kv-item {
  padding: 9px 10px;
  border-radius: var(--radius-control);
}

.kv-item label {
  margin-bottom: 4px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.kv-item span,
.kv-item code {
  font-size: 12px;
}

.params-box {
  min-height: 150px;
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

.detail-empty {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: 1200px) {
  .overview-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .detail-content {
    padding: 0;
  }

  .detail-topbar {
    flex-direction: column;
    padding: 14px;
  }

  .detail-actions {
    width: 100%;
    justify-content: flex-start;
  }

  .overview-grid,
  .meta-strip {
    padding-left: 12px;
    padding-right: 12px;
  }

  .kv-list {
    grid-template-columns: 1fr;
  }
}
</style>
