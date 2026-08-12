<template>
  <div class="detail-header">
    <div class="detail-title">
      <el-icon
        v-if="icon || $slots.icon"
        class="detail-title-icon"
      >
        <slot name="icon">
          <Icon :icon="icon" />
        </slot>
      </el-icon>
      <div class="detail-title-text">
        <div class="detail-title-row">
          <h2>{{ title }}</h2>
          <el-tag
            v-for="(t, idx) in tags"
            :key="idx"
            class="status-badge"
            :class="`status-badge--${t.type || 'info'}`"
            :type="t.type || 'info'"
            :effect="t.effect || 'light'"
            size="small"
            :round="t.round !== false"
          >
            {{ t.label }}
          </el-tag>
          <slot name="badges" />
        </div>
        <p
          v-if="description"
          class="detail-desc"
        >
          {{ description }}
        </p>
        <slot name="meta" />
      </div>
    </div>

    <div
      v-if="$slots.actions"
      class="detail-actions"
    >
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup>
import { Icon } from '@iconify/vue'

/**
 * 详情面板头部。
 *
 * 槽：
 * - icon：替代 icon prop 的标题图标
 * - badges：标题旁追加的 tag/chip
 * - meta：描述下方的额外行（如时间、ID）
 * - actions：右侧操作按钮组
 *
 * tags 格式：[{ label, type?: 'info'|'success'|'primary'|'warning'|'danger', effect?, round? }]
 */
defineProps({
  title:       { type: String, required: true },
  icon:        { type: String, default: '' },
  description: { type: String, default: '' },
  tags:        { type: Array, default: () => [] }
})
</script>

<style scoped>
.detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--app-layout-gap);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--app-surface-border-subtle);
  background: var(--app-container-background);
  flex-shrink: 0;
}

.detail-title {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
  flex: 1;
}

.detail-title-icon {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: var(--app-control-radius);
  background: color-mix(in srgb, var(--el-color-primary) 7%, var(--app-control-background));
  font-size: 18px;
  color: var(--el-color-primary);
  flex-shrink: 0;
}

.detail-title-text {
  min-width: 0;
  flex: 1;
}

.detail-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}

.detail-title-row h2 {
  margin: 0;
  font-size: var(--detail-title-fs);
  font-weight: var(--detail-title-fw);
  color: var(--el-text-color-primary);
  line-height: 1.3;
}

.detail-desc {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.detail-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
</style>
