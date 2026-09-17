<template>
  <section
    class="asset-panel"
    :aria-label="title"
  >
    <slot />
    <p
      v-if="filtered !== total"
      class="asset-filter-result"
      role="status"
    >
      匹配 {{ filtered }} / {{ total }} 项
    </p>
  </section>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  total: { type: Number, default: 0 },
  filtered: { type: Number, default: 0 }
})
</script>

<style scoped>
.asset-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
.asset-filter-result {
  margin: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
