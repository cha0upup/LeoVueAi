<template>
  <div class="composer-dock">
    <div class="composer-inner">
      <div class="composer-box">
        <div class="composer-shell">
          <AiAttachmentList
            class="composer-attachments"
            :files="attachments"
            :removable="!waitingForUserInput"
            @remove="removeAttachment"
          />
          <el-input
            :model-value="modelValue"
            class="composer-input"
            type="textarea"
            :autosize="{ minRows: 1, maxRows: 8 }"
            :maxlength="8000"
            :placeholder="waitingForUserInput ? '请先回答上方问题' : '问我关于平台的任何问题…'"
            :disabled="sending || !ready || waitingForUserInput"
            resize="none"
            @update:model-value="$emit('update:modelValue', $event)"
            @compositionstart="$emit('compositionstart')"
            @compositionend="$emit('compositionend')"
            @keydown="onKeydown"
          />
          <div class="composer-toolbar">
            <AiComposerControls
              :model-value="configId"
              :reasoning-effort="reasoningEffort"
              :configs="configs"
              :attachments="attachments"
              :disabled="sending || !ready || waitingForUserInput"
              @update:model-value="$emit('update:configId', $event)"
              @update:reasoning-effort="$emit('update:reasoningEffort', $event)"
              @update:attachments="$emit('update:attachments', $event)"
            />
          </div>
        </div>
        <el-button
          class="send-fab"
          :type="sending ? 'warning' : 'primary'"
          :disabled="sending ? false : (!modelValue.trim() && !attachments.length) || !ready || waitingForUserInput"
          circle
          :title="sending ? '取消' : '发送'"
          @click="$emit('fab-click')"
        >
          <el-icon class="send-fab-icon">
            <Icon :icon="sending ? iconMap.stop : iconMap.sendArrow" />
          </el-icon>
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { icons } from '@/utils/icons.js'
import AiComposerControls from '@/components/Ai/AiComposerControls.vue'
import AiAttachmentList from '@/components/Ai/AiAttachmentList.vue'

const iconMap = icons

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  sending: {
    type: Boolean,
    default: false
  },
  ready: {
    type: Boolean,
    default: false
  },
  composing: {
    type: Boolean,
    default: false
  },
  configId: { type: [Number, String], default: null },
  reasoningEffort: { type: String, default: 'medium' },
  configs: { type: Array, default: () => [] },
  attachments: { type: Array, default: () => [] },
  waitingForUserInput: { type: Boolean, default: false }
})

const emit = defineEmits([
  'update:modelValue',
  'submit',
  'fab-click',
  'compositionstart',
  'compositionend',
  'update:configId',
  'update:reasoningEffort',
  'update:attachments'
])

const removeAttachment = (id) => {
  emit('update:attachments', props.attachments.filter(file => file.id !== id))
}

const onKeydown = (e) => {
  if (e.key !== 'Enter' || e.shiftKey) return
  if (e.isComposing || e.keyCode === 229 || props.composing) return
  e.preventDefault()
  emit('submit')
}
</script>

<style scoped>
.composer-dock {
  flex-shrink: 0;
  container-type: inline-size;
  container-name: ai-composer;
  padding: 12px 16px 16px;
  background: linear-gradient(180deg, transparent, var(--app-container-background) 18px);
  border-top: 0;
}

.composer-inner {
  max-width: var(--thread-max);
  margin: 0 auto;
}

.composer-box {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 12px 11px 10px 15px;
  border: 0;
  border-radius: 16px;
  background: var(--app-control-background);
  box-shadow: 0 8px 24px color-mix(in srgb, var(--el-text-color-primary) 5%, transparent);
  transition: border-color var(--motion-fast), box-shadow var(--motion-fast);
}

.composer-box:focus-within {
  box-shadow: 0 8px 24px color-mix(in srgb, var(--el-text-color-primary) 5%, transparent),
    0 0 0 2px color-mix(in srgb, var(--el-color-primary) 9%, transparent);
}

.composer-shell {
  flex: 1;
  min-width: 0;
}

.composer-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
}

.composer-attachments { margin-bottom: 10px; }

.composer-input :deep(.el-textarea__inner) {
  border: none;
  box-shadow: none;
  background: transparent;
  color: var(--el-text-color-primary);
  padding: 4px 0 6px;
  font-size: 14px;
  line-height: 1.55;
  min-height: 52px !important;
  resize: none;
}

.composer-input :deep(.el-textarea__inner:focus) {
  box-shadow: none;
}

.composer-input :deep(.el-input__count) {
  background: transparent;
  bottom: 2px;
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.send-fab {
  flex-shrink: 0;
  width: 38px !important;
  height: 38px !important;
  padding: 0 !important;
  border-radius: 12px !important;
  box-shadow: 0 6px 16px color-mix(in srgb, var(--el-color-primary) 18%, transparent);
}

.send-fab-icon {
  font-size: 16px;
}
</style>
