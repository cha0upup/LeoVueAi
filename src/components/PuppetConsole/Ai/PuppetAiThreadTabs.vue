<template>
  <div class="thread-tabs-bar">
    <el-tabs
      :model-value="modelValue"
      type="card"
      :closable="threads.length > 1"
      @update:model-value="$emit('activate', $event)"
      @tab-remove="$emit('delete', $event)"
    >
      <el-tab-pane
        v-for="thread in threads"
        :key="thread.threadId"
        :label="thread.title || '未命名对话'"
        :name="thread.threadId"
      >
        <template #label>
          <span class="tab-label">
            <span
              class="tab-status-dot"
              :class="`is-${getThreadTabStatus(thread, conversationStatus)}`"
            />
            <span class="tab-title-text">{{ thread.title || '未命名对话' }}</span>
          </span>
        </template>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { getThreadTabStatus } from './puppetAiAssistantModel.js'

defineProps({
  modelValue: { type: String, default: null },
  threads: { type: Array, default: () => [] },
  conversationStatus: { type: Object, default: () => ({}) }
})

defineEmits(['activate', 'delete'])
</script>

<style scoped>
/* ── Thread tabs bar ──────────────────────────────────────────────────────────── */

.thread-tabs-bar {
  display: flex;
  align-items: stretch;
  flex-shrink: 0;
  background: var(--ai-muted-surface);
  border-bottom: 0;
  padding: 5px 8px;
  min-height: 40px;
}

.thread-tabs-bar :deep(.el-tabs) {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.thread-tabs-bar :deep(.el-tabs__header) {
  margin: 0;
  border: 0;
}

.thread-tabs-bar :deep(.el-tabs__nav-wrap) {
  overflow: hidden;
}

.thread-tabs-bar :deep(.el-tabs__nav-wrap::after) {
  display: none;
}

.thread-tabs-bar :deep(.el-tabs__nav-scroll) {
  overflow: hidden;
}

.thread-tabs-bar :deep(.el-tabs__nav) {
  border: 0;
}

.thread-tabs-bar :deep(.el-tabs__item) {
  height: 30px;
  line-height: 30px;
  padding: 0 11px;
  margin: 0 4px 0 0;
  border: 0;
  border-radius: 9px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  background: transparent;
  transition: background 0.15s, color 0.15s;
}

.thread-tabs-bar :deep(.el-tabs__item:hover) {
  color: var(--el-text-color-primary);
  background: color-mix(in srgb, var(--el-text-color-primary) 4%, transparent);
}

.thread-tabs-bar :deep(.el-tabs__item.is-active) {
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 8%, transparent);
  font-weight: 600;
}

.thread-tabs-bar :deep(.el-tabs__item .el-icon-close) {
  width: 16px;
  height: 16px;
  margin-left: 4px;
  border-radius: 999px;
  font-size: 12px;
  line-height: 16px;
  transition: background 0.15s;
}

.thread-tabs-bar :deep(.el-tabs__item .el-icon-close:hover) {
  background: color-mix(in srgb, var(--el-text-color-primary) 10%, transparent);
}

/* Tab label with status dot */
.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.tab-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tab-status-dot.is-running {
  background: #f5a524;
  box-shadow: 0 0 0 3px rgba(245, 165, 36, 0.18);
  animation: tab-pulse 1.4s ease-in-out infinite;
}

.tab-status-dot.is-waiting_for_user {
  background: var(--el-color-warning);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--el-color-warning) 18%, transparent);
}

.tab-status-dot.is-failed {
  background: var(--el-color-danger);
}

.tab-status-dot.is-cancelled {
  background: var(--el-text-color-placeholder);
}

.tab-status-dot.is-completed,
.tab-status-dot.is-done,
.tab-status-dot.is-idle {
  background: var(--el-color-success);
}

.tab-title-text {
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}

@keyframes tab-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}
</style>
