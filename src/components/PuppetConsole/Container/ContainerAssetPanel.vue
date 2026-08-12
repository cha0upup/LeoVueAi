<template>
  <section class="asset-panel">
    <header class="asset-panel-header">
      <div class="asset-panel-title">
        <div class="asset-panel-icon">
          <el-icon>
            <Icon :icon="icon" />
          </el-icon>
        </div>
        <div class="asset-panel-heading">
          <div class="asset-panel-heading-main">
            <h3>{{ title }}</h3>
            <el-tag
              size="small"
              effect="plain"
              round
            >
              {{ total }} 项
            </el-tag>
          </div>
          <p>{{ filteredLabel }}</p>
        </div>
      </div>
      <div
        v-if="$slots.toolbar"
        class="asset-panel-toolbar"
      >
        <slot name="toolbar" />
      </div>
    </header>

    <div class="asset-panel-body">
      <slot />
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    required: true
  },
  total: {
    type: Number,
    default: 0
  },
  filtered: {
    type: Number,
    default: 0
  }
})

const filteredLabel = computed(() => {
  if (props.filtered === props.total) {
    return `当前展示全部 ${props.total} 项`
  }

  return `当前命中 ${props.filtered} / ${props.total} 项`
})
</script>

<style scoped>
.asset-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  min-height: 0;
}

.asset-panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.asset-panel-title {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  min-width: 0;
}

.asset-panel-icon {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-container);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--container-muted-surface, var(--el-fill-color-light));
  border: 0;
  box-shadow: none;
  color: var(--el-text-color-secondary);
  font-size: 18px;
  flex-shrink: 0;
}

.asset-panel-heading-main :deep(.el-tag) {
  --el-tag-bg-color: var(--container-muted-surface, var(--el-fill-color-light));
  --el-tag-border-color: transparent;
  --el-tag-text-color: var(--el-text-color-secondary);
}

.asset-panel-heading {
  min-width: 0;
}

.asset-panel-heading-main {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.asset-panel-heading h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.asset-panel-heading p {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.asset-panel-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.asset-panel-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

@media (max-width: 768px) {
  .asset-panel-header {
    flex-direction: column;
    align-items: stretch;
  }

  .asset-panel-toolbar {
    width: 100%;
  }
}
</style>
