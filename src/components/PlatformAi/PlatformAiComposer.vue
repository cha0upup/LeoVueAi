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
            ref="inputRef"
            :model-value="modelValue"
            class="composer-input"
            type="textarea"
            :autosize="{ minRows: 1, maxRows: 8 }"
            :maxlength="8000"
            :placeholder="waitingForUserInput ? '请先回答上方问题' : '描述要在全平台完成的任务…'"
            :disabled="sending || !ready || waitingForUserInput"
            aria-label="平台任务输入"
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
          :title="sending ? '取消请求' : '发送（Enter），Shift + Enter 换行'"
          :aria-label="sending ? '取消请求' : '发送消息'"
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
import { ref } from 'vue'
import { icons } from '@/utils/icons.js'
import AiComposerControls from '@/components/Ai/AiComposerControls.vue'
import AiAttachmentList from '@/components/Ai/AiAttachmentList.vue'

const iconMap = icons
const inputRef = ref(null)
defineExpose({ focus: () => inputRef.value?.focus() })

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

<style scoped src="@/styles/ai-composer-shared.css" />
