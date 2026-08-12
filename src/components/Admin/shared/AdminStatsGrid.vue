<template>
  <section
    class="admin-stats-grid"
    :style="{ '--admin-stats-columns': columns }"
  >
    <slot />
  </section>
</template>

<script setup>
defineProps({
  columns: {
    type: Number,
    default: 4
  }
})
</script>

<style scoped>
.admin-stats-grid {
  display: grid;
  grid-template-columns: repeat(var(--admin-stats-columns), minmax(0, 1fr));
  gap: 0;
  overflow: hidden;
  border: 1px solid var(--app-divider-color);
  border-radius: var(--radius-container);
  background: var(--app-container-background);
}

:deep(.metric-card) {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  min-height: 72px;
  padding: 12px 16px;
  border: 0;
  border-right: 1px solid var(--app-divider-color);
  border-radius: 0;
  background: var(--app-container-background);
  box-shadow: none;
}

:deep(.metric-card:last-child) {
  border-right: 0;
}

:deep(.metric-icon) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  border-radius: var(--radius-control);
  font-size: 18px;
}

:deep(.metric-value) {
  display: block;
  font-size: 20px;
  font-weight: var(--font-weight-title);
  color: var(--el-text-color-primary);
  line-height: 1.1;
}

:deep(.metric-label) {
  display: block;
  margin-top: 4px;
  font-size: var(--el-font-size-small);
  color: var(--el-text-color-secondary);
}

@media (max-width: 1100px) {
  .admin-stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  :deep(.metric-card:nth-child(2n)) {
    border-right: 0;
  }
}

@media (max-width: 640px) {
  .admin-stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
