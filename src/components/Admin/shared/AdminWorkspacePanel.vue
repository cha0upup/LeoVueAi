<template>
  <section class="admin-workspace-panel surface">
    <header class="admin-workspace-panel__header">
      <div class="admin-workspace-panel__title">
        <h2>{{ title }}</h2>
        <div
          v-if="$slots.tags"
          class="admin-workspace-panel__tags"
        >
          <slot name="tags" />
        </div>
      </div>
      <div
        v-if="$slots.actions"
        class="admin-workspace-panel__actions"
      >
        <slot name="actions" />
      </div>
    </header>
    <div class="admin-workspace-panel__body">
      <slot />
    </div>
  </section>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true
  }
})
</script>

<style scoped>
.admin-workspace-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--app-surface-border-strong);
  border-radius: var(--app-panel-radius);
  background: var(--app-card-background);
  box-shadow: none;
}

.admin-workspace-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-layout-gap);
  padding: 12px 16px;
  border-bottom: 1px solid var(--app-surface-border-subtle);
  background: var(--app-container-background);
}

.admin-workspace-panel__title,
.admin-workspace-panel__tags,
.admin-workspace-panel__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.admin-workspace-panel__title h2 {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 15px;
}

.admin-workspace-panel__body {
  flex: 1;
  min-height: 0;
}

@media (max-width: 768px) {
  .admin-workspace-panel__header {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
