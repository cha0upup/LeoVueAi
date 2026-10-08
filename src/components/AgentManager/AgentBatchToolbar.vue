<template>
  <section
    class="batch-toolbar"
    :class="{ 'has-selection': selectedCount > 0 }"
    aria-label="主机批量操作"
  >
    <div class="selection-row">
      <el-checkbox
        :model-value="allSelected"
        :indeterminate="indeterminate"
        :disabled="busy || loading || !visibleCount"
        aria-label="全选当前可见主机"
        @change="$emit('toggle-all')"
      >
        全选当前列表
      </el-checkbox>
      <span
        v-if="selectedCount"
        class="selection-count"
        aria-live="polite"
      >已选 <strong>{{ selectedCount }}</strong> 台</span>
      <span
        v-else
        class="selection-hint"
      >勾选即可批量操作</span>
      <button
        v-if="selectedCount"
        class="clear-selection"
        type="button"
        :disabled="busy || loading"
        @click="$emit('clear')"
      >
        清空
      </button>
    </div>

    <div
      v-if="selectedCount"
      class="selection-actions"
    >
      <p
        v-if="hiddenCount"
        class="hidden-selection"
        role="status"
      >
        含 {{ hiddenCount }} 台未显示主机，操作仍包含这些已选项
      </p>
      <div class="primary-actions">
        <button
          class="batch-button"
          type="button"
          :disabled="busy || loading || testDisabled"
          @click="$emit('test')"
        >
          <Icon
            :icon="action === 'test' ? iconMap.loading : iconMap.test"
            :class="{ 'u-spin': action === 'test' }"
          />
          测试连接
        </button>
        <button
          class="batch-button"
          type="button"
          :disabled="busy || loading"
          @click="$emit('export')"
        >
          <Icon
            :icon="action === 'export' ? iconMap.loading : iconMap.download"
            :class="{ 'u-spin': action === 'export' }"
          />
          导出配置
        </button>
        <button
          class="batch-button"
          type="button"
          :disabled="busy || loading || !canAssign"
          :title="canAssign ? '为已选主机增加项目归属' : '暂无可加入的进行中项目'"
          @click="$emit('assign')"
        >
          <Icon :icon="iconMap.folderAdd" />
          加入项目
        </button>
      </div>
      <div class="secondary-actions">
        <span class="selection-scope">仅操作已选项</span>
        <button
          v-if="canDetach"
          type="button"
          class="secondary-button"
          :disabled="busy || loading"
          title="仅移除项目归属，保留主机资产"
          @click="$emit('detach')"
        >
          移出项目
        </button>
        <button
          type="button"
          class="secondary-button danger"
          :disabled="busy || loading"
          title="删除资产及其子节点，操作前需确认"
          @click="$emit('delete')"
        >
          删除资产
        </button>
      </div>
    </div>

    <div
      v-if="progress"
      class="batch-progress"
      role="status"
      aria-live="polite"
    >
      <div class="progress-caption">
        <span>{{ action === 'test' ? '正在测试' : '测试完成' }} {{ progress.completed }}/{{ progress.total }}</span>
        <span>成功 {{ progress.succeeded }} · 失败 {{ progress.failed }}</span>
      </div>
      <progress
        :value="progress.completed"
        :max="progress.total"
        aria-label="批量连接测试进度"
      />
    </div>
    <p
      v-else-if="busy && action"
      class="operation-status"
      role="status"
    >
      {{ actionLabels[action] }}，请稍候…
    </p>
  </section>
</template>

<script setup>
import { Icon } from '@iconify/vue'
import { icons } from '@/utils/icons.js'

defineProps({
  selectedCount: { type: Number, default: 0 },
  visibleCount: { type: Number, default: 0 },
  allSelected: { type: Boolean, default: false },
  indeterminate: { type: Boolean, default: false },
  hiddenCount: { type: Number, default: 0 },
  busy: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  testDisabled: { type: Boolean, default: false },
  canAssign: { type: Boolean, default: false },
  canDetach: { type: Boolean, default: false },
  action: { type: String, default: '' },
  progress: { type: Object, default: null }
})
defineEmits(['toggle-all', 'clear', 'test', 'export', 'assign', 'detach', 'delete'])
const iconMap = icons
const actionLabels = { export: '正在导出配置', delete: '正在删除资产', detach: '正在移出项目' }
</script>

<style scoped>
.batch-toolbar {
  flex-shrink: 0;
  margin: 0 var(--agent-directory-padding, 8px);
  color: var(--el-text-color-regular);
}
.selection-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
}
.selection-row :deep(.el-checkbox) {
  height: 30px;
  margin-left: var(--agent-expand-gutter, 22px);
  margin-right: auto;
}
.selection-row :deep(.el-checkbox__inner) {
  width: 14px;
  height: 14px;
  border-radius: 4px;
}
.selection-row :deep(.el-checkbox__label) {
  padding-left: 6px;
  font-size: 11px;
  font-weight: 500;
}
.selection-hint,
.selection-count,
.clear-selection {
  font-size: 11px;
  white-space: nowrap;
}
.selection-hint {
  color: var(--el-text-color-placeholder);
}
.selection-count {
  color: var(--el-color-primary);
}
.clear-selection,
.secondary-button {
  padding: 4px 0;
  border: 0;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  font-family: inherit;
}
.clear-selection:hover,
.secondary-button:hover {
  color: var(--el-color-primary);
}
.selection-actions {
  padding: 10px;
  margin-bottom: 4px;
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 18%, var(--app-border-color));
  border-radius: var(--radius-control);
  background: var(--app-card-background);
}
.primary-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}
.batch-button {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: 5px;
  min-width: 0;
  height: 32px;
  padding: 0 4px;
  border: 1px solid var(--app-border-color);
  border-radius: var(--radius-control);
  background: var(--app-control-background-soft);
  color: var(--el-text-color-regular);
  font-size: 11px;
  font-weight: 600;
  font-family: inherit;
  white-space: nowrap;
  cursor: pointer;
  transition: border-color var(--motion-fast), color var(--motion-fast);
}
.batch-button svg {
  flex-shrink: 0;
  font-size: 13px;
}
.batch-button:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}
.secondary-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 8px;
}
.selection-scope {
  margin-right: auto;
  color: var(--el-text-color-placeholder);
  font-size: 10px;
}
.secondary-button {
  font-size: 11px;
}
.danger {
  color: var(--el-color-danger);
}
.danger:hover {
  color: var(--el-color-danger-dark-2);
}
button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
button:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}
.hidden-selection {
  margin: 0 0 8px;
  color: var(--el-color-warning-dark-2);
  font-size: 10px;
  line-height: 1.5;
}
.batch-progress,
.operation-status {
  margin: 8px 0;
  font-size: 10px;
  color: var(--el-text-color-secondary);
}
.progress-caption {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}
progress {
  display: block;
  width: 100%;
  height: 4px;
  accent-color: var(--el-color-primary);
  border: 0;
  border-radius: 4px;
  overflow: hidden;
}
progress::-webkit-progress-bar {
  background: var(--app-hover-background);
}
progress::-webkit-progress-value {
  background: var(--el-color-primary);
}
</style>
