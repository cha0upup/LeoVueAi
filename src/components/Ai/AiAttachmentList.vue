<template>
  <div
    v-if="files.length"
    class="ai-attachment-list"
    :class="`ai-attachment-list--${variant}`"
  >
    <div
      v-for="(file, index) in files"
      :key="file.id || `${file.name}-${file.size}-${index}`"
      class="ai-attachment-card"
    >
      <span
        class="ai-attachment-card__icon"
        :style="{ color: iconFor(file).color }"
      >
        <Icon :icon="iconFor(file).icon" />
      </span>
      <span class="ai-attachment-card__body">
        <span
          class="ai-attachment-card__name"
          :title="file.name"
        >{{ file.name }}</span>
        <span class="ai-attachment-card__meta">
          {{ extensionFor(file) }}<template v-if="file.size != null"> · {{ formatFileSize(file.size) }}</template>
        </span>
      </span>
      <button
        v-if="removable"
        type="button"
        class="ai-attachment-card__remove"
        :title="`移除 ${file.name}`"
        :aria-label="`移除附件 ${file.name}`"
        @click="emit('remove', file.id)"
      >
        <Icon icon="lucide:x" />
      </button>
      <span
        v-else
        class="ai-attachment-card__state"
        title="附件已随消息发送"
      >
        <Icon icon="lucide:check" />
      </span>
    </div>
  </div>
</template>

<script setup>
import { formatFileSize } from '@/utils/format.js'
import { getFileIconPresentation } from '@/utils/fileIcons.js'

defineProps({
  files: { type: Array, default: () => [] },
  removable: { type: Boolean, default: false },
  variant: { type: String, default: 'composer' }
})

const emit = defineEmits(['remove'])

const iconFor = (file) => getFileIconPresentation(file)

const extensionFor = (file) => {
  const name = String(file?.name || '')
  const dot = name.lastIndexOf('.')
  return dot > -1 && dot < name.length - 1
    ? name.slice(dot + 1).toUpperCase()
    : '文件'
}
</script>

<style scoped>
.ai-attachment-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));
  gap: 8px;
}

.ai-attachment-card {
  display: flex;
  align-items: center;
  min-width: 0;
  padding: 8px 9px;
  border: 0;
  border-radius: 10px;
  background: color-mix(in srgb, var(--el-text-color-primary) 5%, transparent);
}

.ai-attachment-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  margin-right: 9px;
  border-radius: 9px;
  background: color-mix(in srgb, currentColor 10%, transparent);
  font-size: 18px;
}

.ai-attachment-card__body {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.ai-attachment-card__name {
  overflow: hidden;
  color: var(--el-text-color-primary);
  font-size: 12px;
  font-weight: 650;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-attachment-card__meta {
  color: var(--el-text-color-secondary);
  font-size: 10px;
  line-height: 1.3;
}

.ai-attachment-card__remove,
.ai-attachment-card__state {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  flex: 0 0 26px;
  margin-left: 5px;
  border: 0;
  border-radius: 7px;
  color: var(--el-text-color-secondary);
  background: transparent;
}

.ai-attachment-card__remove {
  cursor: pointer;
}

.ai-attachment-card__remove:hover {
  color: var(--el-color-danger);
  background: color-mix(in srgb, var(--el-color-danger) 9%, transparent);
}

.ai-attachment-card__state {
  color: var(--el-color-success);
  font-size: 14px;
}

.ai-attachment-list--message {
  grid-template-columns: repeat(auto-fit, minmax(min(190px, 100%), 1fr));
}

.ai-attachment-list--message .ai-attachment-card {
  background: color-mix(in srgb, var(--app-control-background) 72%, transparent);
}
</style>
