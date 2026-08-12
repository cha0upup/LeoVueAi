<template>
  <div
    class="empty-state"
    :class="{
      'is-compact': compact,
      'is-workbench': workbench
    }"
  >
    <div
      v-if="workbench"
      class="workbench-empty"
    >
      <div
        v-if="icon || $slots.icon"
        class="workbench-empty-icon"
      >
        <slot name="icon">
          <el-icon><Icon :icon="icon" /></el-icon>
        </slot>
      </div>
      <h3 v-if="title">
        {{ title }}
      </h3>
      <p>{{ description }}</p>
      <div
        v-if="$slots.default || actionLabel"
        class="workbench-empty-actions"
      >
        <slot>
          <el-button
            v-if="actionLabel"
            type="primary"
            @click="$emit('action')"
          >
            <el-icon v-if="actionIcon">
              <Icon :icon="actionIcon" />
            </el-icon>
            {{ actionLabel }}
          </el-button>
        </slot>
      </div>
    </div>

    <el-empty
      v-else
      :description="description"
      :image-size="compact ? 60 : 80"
    >
      <template
        v-if="$slots.default || actionLabel"
        #default
      >
        <slot>
          <el-button
            v-if="actionLabel"
            type="primary"
            @click="$emit('action')"
          >
            <el-icon v-if="actionIcon">
              <Icon :icon="actionIcon" />
            </el-icon>
            {{ actionLabel }}
          </el-button>
        </slot>
      </template>
    </el-empty>
  </div>
</template>

<script setup>
import { Icon } from '@iconify/vue'

/**
 * 空状态——统一的占位/引导组件。
 *
 * 简单用法：
 *   <EmptyState description="暂无 skill" />
 *
 * 带引导操作：
 *   <EmptyState
 *     description="还没有创建过 skill"
 *     action-label="新建 Skill"
 *     :action-icon="iconMap.add"
 *     @action="openCreateDialog"
 *   />
 *
 * 自定义内容：
 *   <EmptyState description="...">
 *     <el-button>选项 A</el-button>
 *     <el-button>选项 B</el-button>
 *   </EmptyState>
 */
defineProps({
  title:       { type: String, default: '' },
  description: { type: String, default: '暂无数据' },
  icon:        { type: String, default: '' },
  actionLabel: { type: String, default: '' },
  actionIcon:  { type: String, default: '' },
  compact:     { type: Boolean, default: false },
  workbench:   { type: Boolean, default: false }
})

defineEmits(['action'])
</script>

<style scoped>
.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.empty-state.is-compact {
  padding: 12px;
}

.empty-state :deep(.el-empty__description) {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-top: 8px;
}

.workbench-empty {
  max-width: 360px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  color: var(--el-text-color-secondary);
}

.workbench-empty-icon {
  width: 44px;
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--el-color-primary) 8%, var(--app-control-background));
  color: var(--el-color-primary);
  font-size: 20px;
}

.workbench-empty h3 {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 17px;
  line-height: 1.35;
}

.workbench-empty p {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.7;
}

.workbench-empty-actions {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 16px;
}
</style>
