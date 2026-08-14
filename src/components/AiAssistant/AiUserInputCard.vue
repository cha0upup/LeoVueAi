<template>
  <section
    class="user-input-card"
    :class="[`is-${risk.toLowerCase()}`, { 'is-resolved': resolved }]"
    :aria-busy="submitting"
  >
    <header class="user-input-card__header">
      <Icon :icon="confirmation ? 'mdi:shield-alert-outline' : 'mdi:help-circle-outline'" />
      <strong>{{ resolved ? '用户问题已处理' : confirmation ? '需要操作确认' : '需要补充信息' }}</strong>
      <span
        v-if="showRisk"
        class="user-input-card__risk"
      >{{ riskLabel }}</span>
      <span
        v-if="resolved"
        class="user-input-card__status"
      >{{ statusLabel }}</span>
    </header>

    <template v-if="!resolved">
      <p class="user-input-card__prompt">
        {{ request.prompt }}
      </p>
      <p
        v-if="request.actionSummary"
        class="user-input-card__action"
      >
        {{ request.actionSummary }}
      </p>
      <div
        v-if="normalizedOptions.length"
        class="user-input-card__options"
      >
        <el-button
          v-for="option in normalizedOptions"
          :key="option.value"
          size="small"
          :type="optionButtonType(option)"
          :disabled="submitting"
          @click="submit(option.value)"
        >
          {{ option.label }}
        </el-button>
        <el-button
          v-if="canUseCustomAnswer"
          size="small"
          plain
          :disabled="submitting"
          @click="customAnswerOpen = true"
        >
          <Icon icon="mdi:pencil-outline" />
          自定义回答
        </el-button>
      </div>
      <el-button
        v-else-if="canUseCustomAnswer && !customAnswerOpen"
        class="user-input-card__custom-trigger"
        size="small"
        plain
        :disabled="submitting"
        @click="customAnswerOpen = true"
      >
        <Icon icon="mdi:pencil-outline" />
        输入具体要求
      </el-button>
      <div
        v-if="customAnswerOpen && canUseCustomAnswer"
        class="user-input-card__custom"
      >
        <el-input
          v-model="customAnswer"
          type="textarea"
          :rows="3"
          :maxlength="2000"
          show-word-limit
          autofocus
          placeholder="请输入针对当前问题的具体回答"
          :disabled="submitting"
          @keydown.ctrl.enter.prevent="submitCustom"
          @keydown.meta.enter.prevent="submitCustom"
        />
        <div class="user-input-card__custom-actions">
          <el-button
            size="small"
            text
            :disabled="submitting"
            @click="cancelCustom"
          >
            取消
          </el-button>
          <el-button
            size="small"
            type="primary"
            :disabled="submitting || !customAnswer.trim()"
            @click="submitCustom"
          >
            提交回答
          </el-button>
        </div>
      </div>
      <footer class="user-input-card__footer">
        <small v-if="canUseCustomAnswer && !customAnswerOpen">可在卡片内补充具体回答</small>
        <small v-if="expiryLabel">{{ expiryLabel }}</small>
        <small v-if="submitting">正在提交回答…</small>
      </footer>
    </template>
    <p
      v-else
      class="user-input-card__resolved"
    >
      {{ request.answer ? `已回答：${resolvedAnswer}` : request.prompt }}
    </p>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  request: { type: Object, required: true },
  submitting: { type: Boolean, default: false }
})

const emit = defineEmits(['answer'])
// 澄清问题直接展示输入框；确认问题由 canUseCustomAnswer 自动隐藏。
const customAnswerOpen = ref(true)
const customAnswer = ref('')

const confirmation = computed(() => props.request?.type === 'CONFIRMATION')
const normalizedOptions = computed(() => (Array.isArray(props.request?.options)
  ? props.request.options.map(option => ({
    label: String(option?.label ?? ''),
    value: String(option?.value ?? ''),
    intent: String(option?.intent ?? '')
  })).filter(option => option.label && option.value)
  : []))
const canUseCustomAnswer = computed(() => Boolean(props.request?.allowFreeText) && !confirmation.value)
const resolvedAnswer = computed(() => {
  const answer = String(props.request?.answer || '')
  return normalizedOptions.value.find(option => option.value === answer)?.label || answer
})
const status = computed(() => String(props.request?.status || 'pending').toLowerCase())
const resolved = computed(() => !['pending', 'answering'].includes(status.value))
const risk = computed(() => String(props.request?.risk || 'LOW').toUpperCase())
const showRisk = computed(() => confirmation.value || !['LOW', ''].includes(risk.value))
const riskLabel = computed(() => ({
  LOW: '低风险', MEDIUM: '中风险', HIGH: '高风险', CRITICAL: '严重风险'
})[risk.value] || '待确认')
const statusLabel = computed(() => ({
  answered: '已回答', expired: '已过期', cancelled: '已取消'
})[status.value] || '已处理')
const expiryLabel = computed(() => {
  const expiresAt = Number(props.request?.expiresAt)
  if (!Number.isFinite(expiresAt) || expiresAt <= 0) return ''
  return `有效期至 ${new Date(expiresAt).toLocaleString('zh-CN', { hour12: false })}`
})

function optionButtonType(option) {
  if (!confirmation.value) return 'default'
  const value = `${option?.value || ''} ${option?.label || ''} ${option?.intent || ''}`.trim().toLowerCase()
  if (value.startsWith('确认') || value.startsWith('同意') || value.startsWith('继续') || value === 'yes' || value === 'confirm') return 'primary'
  if (value.startsWith('取消') || value.startsWith('拒绝') || value.startsWith('不') || value === 'no' || value === 'cancel') return 'danger'
  return 'default'
}

function submit(answer) {
  if (props.submitting || !answer) return
  emit('answer', String(answer))
}

function submitCustom() {
  const answer = customAnswer.value.trim()
  if (!answer || props.submitting) return
  submit(answer)
}

function cancelCustom() {
  customAnswerOpen.value = false
  customAnswer.value = ''
}
</script>

<style scoped>
.user-input-card {
  margin: 8px 0;
  padding: 13px 14px;
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 32%, transparent);
  border-radius: 11px;
  background: color-mix(in srgb, var(--el-color-primary) 6%, var(--el-bg-color));
}

.user-input-card.is-high {
  border-color: color-mix(in srgb, var(--el-color-warning) 52%, transparent);
  background: color-mix(in srgb, var(--el-color-warning) 8%, var(--el-bg-color));
}

.user-input-card.is-critical {
  border-color: color-mix(in srgb, var(--el-color-danger) 55%, transparent);
  background: color-mix(in srgb, var(--el-color-danger) 7%, var(--el-bg-color));
}

.user-input-card.is-resolved {
  padding: 9px 12px;
  border-color: var(--el-border-color-lighter);
  background: color-mix(in srgb, var(--el-fill-color-light) 70%, transparent);
}

.user-input-card__header {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--el-text-color-primary);
}

.user-input-card__risk,
.user-input-card__status {
  margin-left: auto;
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.user-input-card__prompt {
  margin: 9px 0 6px;
  color: var(--el-text-color-primary);
  line-height: 1.65;
}

.user-input-card__action,
.user-input-card__resolved {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.55;
}

.user-input-card__action {
  white-space: pre-line;
}

.user-input-card__options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.user-input-card__options :deep(.el-button + .el-button) {
  margin-left: 0;
}

.user-input-card__custom-trigger {
  margin-top: 10px;
}

.user-input-card__custom {
  margin-top: 10px;
}

.user-input-card__custom-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

.user-input-card__footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 5px 12px;
  margin-top: 9px;
  color: var(--el-text-color-secondary);
}

.user-input-card__resolved {
  margin-top: 5px;
}

@media (max-width: 560px) {
  .user-input-card__options {
    display: grid;
    grid-template-columns: 1fr;
  }

  .user-input-card__options :deep(.el-button) {
    width: 100%;
  }
}
</style>
