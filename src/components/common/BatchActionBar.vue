<template>
  <Transition name="batch-bar-fade">
    <div
      v-if="count > 0"
      class="batch-bar"
    >
      <el-checkbox
        :model-value="allSelected"
        :indeterminate="someSelected"
        @change="$emit('toggle-all', $event)"
      >
        已选 {{ count }}<template v-if="totalLabel">
          / {{ totalLabel }}
        </template>
      </el-checkbox>

      <div class="batch-bar-actions">
        <slot />
        <el-button
          size="small"
          text
          @click="$emit('clear')"
        >
          取消
        </el-button>
      </div>
    </div>
  </Transition>
</template>

<script setup>
/**
 * 批量操作条。
 *
 * 当 count > 0 时显示，sticky 在列表顶部。
 *
 * Props：
 * - count：当前已选数量
 * - allSelected / someSelected：用于 checkbox 的 model 和 indeterminate 状态
 * - totalLabel：可选，显示「已选 3 / 12」中的 12
 *
 * 槽默认插入主操作（导出、删除等），建议用 el-button size="small"。
 *
 * 事件：
 * - toggle-all（boolean）：全选切换
 * - clear：清空选中
 */
defineProps({
  count:        { type: Number, required: true },
  allSelected:  { type: Boolean, default: false },
  someSelected: { type: Boolean, default: false },
  totalLabel:   { type: [String, Number], default: '' }
})

defineEmits(['toggle-all', 'clear'])
</script>

<style scoped>
.batch-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 12px;
  margin: 0 var(--list-item-padding-x) 8px;
  border-radius: var(--radius-control);
  background: var(--app-selected-background);
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 24%, var(--app-border-color));
  flex-shrink: 0;
  z-index: var(--z-sticky-bar);
}

.batch-bar :deep(.el-checkbox__label) {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-color-primary);
}

.batch-bar-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-left: auto;
}

.batch-bar-fade-enter-active,
.batch-bar-fade-leave-active {
  transition: opacity var(--motion-fast) var(--motion-easing),
              transform var(--motion-fast) var(--motion-easing);
}

.batch-bar-fade-enter-from,
.batch-bar-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
