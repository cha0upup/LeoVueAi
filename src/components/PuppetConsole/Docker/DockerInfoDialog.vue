<template>
  <el-dialog
    :model-value="visible"
    :title="title"
    width="70%"
    destroy-on-close
    @update:model-value="$emit('update:visible', $event)"
    @closed="$emit('closed')"
  >
    <div
      v-if="loading"
      class="docker-info-loading"
    >
      <el-icon class="is-loading">
        <Icon icon="mdi:loading" />
      </el-icon>
      正在加载...
    </div>
    <pre
      v-else
      class="detail-pre"
    >{{ content }}</pre>
  </el-dialog>
</template>

<script setup>
import { Icon } from '@iconify/vue'

defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: '' },
  content: { type: String, default: '' },
  loading: { type: Boolean, default: false }
})

defineEmits(['update:visible', 'closed'])
</script>

<style scoped>
.docker-info-loading {
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--el-text-color-secondary);
}

.detail-pre {
  margin: 0;
  max-height: 60vh;
  overflow: auto;
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
