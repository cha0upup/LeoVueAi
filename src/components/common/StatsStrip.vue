<template>
  <section
    class="stats-strip"
    :style="{ '--stats-columns': columns }"
  >
    <slot />
  </section>
</template>

<script setup>
defineProps({ columns: { type: Number, default: 4 } })
</script>

<style scoped>
.stats-strip {
  display: grid;
  grid-template-columns: repeat(var(--stats-columns), minmax(0, 1fr));
  flex-shrink: 0;
  gap: 1px;
  overflow: hidden;
  border: 1px solid var(--app-divider-color);
  border-radius: var(--radius-container);
  background: var(--app-divider-color);
}

:deep(.metric-card) {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-content: center;
  align-items: center;
  gap: 0 var(--space-2);
  min-width: 0;
  min-height: 60px;
  margin: 0;
  padding: 10px var(--space-3);
  border: 0;
  border-radius: 0;
  color: var(--el-text-color-primary);
  background: var(--app-container-background);
  text-align: left;
  box-shadow: none;
}

:deep(.metric-label),
:deep(.metric-hint) {
  grid-column: 1;
  min-width: 0;
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: var(--font-size-label);
  font-weight: var(--font-weight-medium);
  line-height: 18px;
  overflow-wrap: anywhere;
}

:deep(.metric-hint) {
  grid-row: 2;
  font-weight: 400;
}

:deep(.metric-value) {
  grid-column: 2;
  grid-row: 1 / span 2;
  align-self: center;
  color: var(--el-text-color-primary);
  font-size: 20px;
  font-weight: var(--font-weight-title);
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}

:deep(.metric-card--success .metric-value) { color: var(--el-color-success); }
:deep(.metric-card--warning .metric-value) { color: var(--el-color-warning); }
:deep(.metric-card--danger .metric-value) { color: var(--el-color-danger); }
:deep(.metric-card--time .metric-value) {
  max-width: 14ch;
  font-size: var(--font-size-helper);
  overflow-wrap: anywhere;
}

:deep(button.metric-card) {
  font-family: inherit;
  cursor: pointer;
  transition: background var(--motion-fast) var(--motion-easing);
}

:deep(button.metric-card:hover),
:deep(button.metric-card.is-active) {
  background: var(--app-selected-background);
}

:deep(button.metric-card.is-active) {
  box-shadow: inset 0 -2px var(--el-color-primary);
}

:deep(button.metric-card:focus-visible) {
  outline: var(--focus-outline);
  outline-offset: -2px;
}

@container (max-width: 680px) {
  .stats-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@container (max-width: 280px) {
  .stats-strip { grid-template-columns: 1fr; }
}
</style>
