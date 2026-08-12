<template>
  <div class="ai-composer-controls">
    <input
      ref="fileInputRef"
      class="file-input"
      type="file"
      multiple
      :accept="accept"
      @change="onFilesSelected"
    >
    <el-button
      class="attach-button"
      text
      circle
      :disabled="disabled"
      title="添加附件（单个不超过 1 MB，最多 10 个）"
      aria-label="添加附件"
      @click="fileInputRef?.click()"
    >
      <Icon icon="lucide:paperclip" />
    </el-button>

    <span class="composer-shortcut">Enter 发送 · Shift + Enter 换行</span>

    <el-popover
      v-model:visible="menuVisible"
      placement="top-end"
      :width="350"
      trigger="click"
      popper-class="ai-model-popper"
      :disabled="disabled"
    >
      <template #reference>
        <button
          class="model-trigger"
          type="button"
          :disabled="disabled"
        >
          <span class="model-trigger__name">{{ selectedModelLabel }}</span>
          <span
            v-if="supportsReasoning"
            class="model-trigger__effort"
          >{{ effortLabel }}</span>
          <Icon icon="lucide:chevron-down" />
        </button>
      </template>

      <div class="settings-menu">
        <div class="settings-menu__header">
          <strong>响应设置</strong>
          <span>仅作用于当前对话</span>
        </div>
        <label class="settings-row">
          <span class="settings-row__label">模型</span>
          <el-select
            :model-value="modelValue"
            class="settings-row__select"
            placeholder="选择模型"
            @update:model-value="emit('update:modelValue', $event)"
          >
            <el-option
              v-for="config in configs"
              :key="config.id"
              :value="config.id"
              :label="config.name"
            >
              <div class="model-option">
                <span>{{ config.name }}</span>
                <small>{{ config.model }}</small>
              </div>
            </el-option>
          </el-select>
        </label>
        <label
          class="settings-row"
          :class="{ 'settings-row--disabled': !supportsReasoning }"
        >
          <span class="settings-row__label">推理强度</span>
          <el-select
            :model-value="reasoningEffort"
            class="settings-row__select"
            :disabled="!supportsReasoning"
            @update:model-value="emit('update:reasoningEffort', $event)"
          >
            <el-option
              v-for="option in reasoningOptions"
              :key="option.value"
              :value="option.value"
              :label="option.label"
            />
          </el-select>
        </label>
        <p
          v-if="!supportsReasoning"
          class="reasoning-hint"
        >
          当前模型不支持推理强度调节
        </p>
      </div>
    </el-popover>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'

const MAX_FILE_SIZE = 1024 * 1024
const MAX_TOTAL_SIZE = 3 * 1024 * 1024
const MAX_FILE_COUNT = 10

const props = defineProps({
  modelValue: { type: [Number, String], default: null },
  reasoningEffort: { type: String, default: 'medium' },
  configs: { type: Array, default: () => [] },
  attachments: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
  accept: {
    type: String,
    default: '.txt,.md,.json,.jsonl,.xml,.yaml,.yml,.csv,.tsv,.log,.properties,.ini,.conf,.java,.kt,.js,.jsx,.ts,.tsx,.vue,.html,.css,.scss,.less,.sql,.py,.go,.rs,.c,.h,.cpp,.hpp,.sh,.zsh,.ps1'
  }
})

const emit = defineEmits(['update:modelValue', 'update:reasoningEffort', 'update:attachments'])
const fileInputRef = ref(null)
const menuVisible = ref(false)
const reasoningOptions = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'xhigh', label: '极高' }
]

const selectedConfig = computed(() => props.configs.find(config => config.id === props.modelValue))
const selectedModelLabel = computed(() => selectedConfig.value?.model || selectedConfig.value?.name || '选择模型')
const supportsReasoning = computed(() => selectedConfig.value?.supportsReasoning === true || selectedConfig.value?.supportsReasoning === 1)
const effortLabel = computed(() => reasoningOptions.find(option => option.value === props.reasoningEffort)?.label || '中')

async function onFilesSelected(event) {
  const selected = Array.from(event.target.files || [])
  event.target.value = ''
  if (!selected.length) return

  const next = [...props.attachments]
  let totalSize = next.reduce((sum, file) => sum + Number(file.size || 0), 0)
  for (const file of selected) {
    if (next.length >= MAX_FILE_COUNT) {
      ElMessage.warning('单次最多添加 10 个附件')
      break
    }
    if (file.size > MAX_FILE_SIZE) {
      ElMessage.warning(`${file.name} 超过 1 MB，未添加`)
      continue
    }
    if (totalSize + file.size > MAX_TOTAL_SIZE) {
      ElMessage.warning('附件总大小不能超过 3 MB')
      break
    }
    try {
      const content = await file.text()
      next.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        mimeType: file.type || 'text/plain',
        size: file.size,
        content
      })
      totalSize += file.size
    } catch {
      ElMessage.warning(`${file.name} 无法读取，未添加`)
    }
  }
  emit('update:attachments', next)
}
</script>

<style scoped>
.ai-composer-controls { display: flex; align-items: center; gap: 10px; width: 100%; min-width: 0; }
.file-input { display: none; }
.attach-button { width: 32px; height: 32px; color: var(--el-text-color-regular); font-size: 18px; }
.composer-shortcut { flex: 1; min-width: 0; overflow: hidden; color: var(--el-text-color-placeholder); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.model-trigger { display: inline-flex; align-items: center; gap: 7px; min-width: 0; max-width: 260px; height: 34px; margin-left: auto; padding: 0 13px; border: 0; border-radius: 17px; color: var(--el-text-color-primary); background: color-mix(in srgb, var(--el-text-color-primary) 5%, transparent); cursor: pointer; flex-shrink: 1; }
.model-trigger:hover:not(:disabled) { background: color-mix(in srgb, var(--el-color-primary) 7%, transparent); }
.model-trigger:disabled { cursor: not-allowed; opacity: .55; }
.model-trigger__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.model-trigger__effort { color: var(--el-text-color-secondary); flex-shrink: 0; }
.settings-menu { display: grid; gap: 6px; padding: 4px; }
.settings-menu__header { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 4px 4px 6px; }
.settings-menu__header strong { color: var(--el-text-color-primary); font-size: 13px; }
.settings-menu__header span { color: var(--el-text-color-placeholder); font-size: 10px; }
.settings-row { display: grid; grid-template-columns: 76px minmax(0, 1fr); align-items: center; gap: 12px; min-height: 42px; padding: 0 4px; }
.settings-row__label { font-size: 12px; font-weight: 600; color: var(--el-text-color-regular); }
.settings-row__select { width: 100%; }
.settings-row--disabled { opacity: .55; }
.reasoning-hint { margin: -4px 0 4px 92px; color: var(--el-text-color-secondary); font-size: 11px; }
.model-option { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.model-option small { overflow: hidden; color: var(--el-text-color-secondary); text-overflow: ellipsis; }

@media (max-width: 640px) {
  .composer-shortcut { display: none; }
}

@container ai-composer (max-width: 560px) {
  .ai-composer-controls { gap: 6px; }
  .composer-shortcut { display: none; }
  .model-trigger { max-width: calc(100% - 40px); padding: 0 10px; }
}

@container ai-composer (max-width: 420px) {
  .attach-button { width: 30px; height: 30px; }
  .model-trigger { max-width: calc(100% - 36px); height: 32px; }
  .model-trigger__effort { display: none; }
}
</style>
