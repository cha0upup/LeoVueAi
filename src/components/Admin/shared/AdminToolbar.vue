<template>
  <section class="admin-toolbar surface">
    <div class="admin-toolbar__main">
      <slot />
    </div>
    <div
      v-if="$slots.actions"
      class="admin-toolbar__actions"
    >
      <slot name="actions" />
    </div>
  </section>
</template>

<style scoped>
.admin-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-layout-gap);
  flex-wrap: wrap;
  min-height: 48px;
  padding: 8px 16px;
  border: 1px solid var(--app-divider-color);
  border-radius: var(--radius-container);
  background: var(--app-container-background);
  box-shadow: none;
}

.admin-toolbar__main,
.admin-toolbar__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.admin-toolbar__main { flex: 1 1 560px; min-width: 0; }
.admin-toolbar__actions { flex: 0 0 auto; margin-left: auto; }
.admin-toolbar__actions :deep(.el-button + .el-button) { margin-left: 0; }
</style>
