<template>
  <header class="workbench-page-header">
    <div class="workbench-page-header__heading">
      <el-icon
        v-if="icon"
        class="workbench-page-header__icon"
        aria-hidden="true"
      >
        <Icon :icon="icon" />
      </el-icon>
      <h1>{{ title }}</h1>
      <div
        v-if="$slots.meta"
        class="workbench-page-header__meta"
      >
        <slot name="meta" />
      </div>
    </div>
    <div
      v-if="$slots.actions"
      class="workbench-page-header__actions"
    >
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  icon: { type: String, default: '' }
})
</script>

<style scoped>
.workbench-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  flex-shrink: 0;
  gap: var(--space-2) var(--space-3);
  min-height: var(--control-height);
}

.workbench-page-header__heading,
.workbench-page-header__actions,
.workbench-page-header__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  min-width: 0;
}

.workbench-page-header__icon {
  flex-shrink: 0;
  color: var(--el-color-primary);
  font-size: 20px;
}

h1 {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: var(--font-size-page-title);
  font-weight: var(--font-weight-title);
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.workbench-page-header__meta {
  color: var(--el-text-color-secondary);
  font-size: var(--font-size-helper);
}

.workbench-page-header__actions :deep(.el-button + .el-button) {
  margin-left: 0;
}
</style>
