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
  border: 0;
  border-bottom: 1px solid var(--app-divider-color);
  border-radius: 0;
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
</style>
