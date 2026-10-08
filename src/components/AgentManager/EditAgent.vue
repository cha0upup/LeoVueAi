<template>
  <el-dialog
    v-model="editAgentDialog"
    width="900px"
    top="4vh"
    draggable
    class="agent-dialog edit-agent-dialog"
    @opened="scrollFormToTop"
    @close="close"
  >
    <template #header>
      <div class="dialog-intro dialog-header-intro">
        <div class="intro-main">
          <div class="intro-title-row">
            <el-icon class="intro-icon">
              <Icon :icon="iconMap.edit" />
            </el-icon>
            <div>
              <h3>调整主机配置</h3>
            </div>
          </div>
        </div>
      </div>
    </template>

    <ParentHostSummary
      v-if="parentContext"
      :host="parentContext.host"
      :status="parentContext.status"
      :status-label="parentContext.label"
    />

    <AgentFormFields
      ref="formRef"
      v-model:agent="agent"
      v-model:proxy-enabled="proxyEnabled"
      v-model:url-strategy-enabled="urlStrategyEnabled"
      v-model:url-strategy-form="urlStrategyForm"
      v-model:padding-enabled="paddingEnabled"
      v-model:padding-preset="paddingPreset"
      v-model:padding-form="paddingForm"
      v-model:header-noise-enabled="headerNoiseEnabled"
      v-model:header-noise-form="headerNoiseForm"
      v-model:tls-fingerprint-enabled="tlsFingerprintEnabled"
      v-model:tls-fingerprint-form="tlsFingerprintForm"
      :rules="rules"
      :disguises="allDisguises"
      :probing="probing"
      @submit="handleEdit"
      @probe="handleProbe"
      @apply-padding-preset="applyPaddingPreset"
    />

    <template #footer>
      <div class="dialog-footer-stack">
        <AgentConnectionResultBanner
          v-if="testResult"
          class="form-test-result"
          :result="testResult"
          @dismiss="testResult = null"
        />
        <div class="dialog-footer-actions">
          <el-button
            class="cancel-btn"
            @click="close"
          >
            取消
          </el-button>
          <el-button
            class="test-btn"
            :loading="testingConnection"
            :disabled="loading"
            @click="testConnection"
          >
            <el-icon v-if="!testingConnection">
              <Icon :icon="iconMap.test" />
            </el-icon>
            测试连接
          </el-button>
          <el-button
            type="primary"
            :loading="loading"
            :disabled="testingConnection"
            class="submit-btn"
            @click="handleEdit"
          >
            <el-icon><Icon :icon="iconMap.check" /></el-icon>
            {{ loading ? '更新中...' : '更新主机' }}
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref } from 'vue'
import { icons } from '@/utils/icons.js'
import { useDialog } from '@/utils/dialogUtils.js'
import { executeRequest } from '@/utils/apiUtils.js'
import { useAgentForm } from '@/composables/useAgentForm.js'
import AgentFormFields from './AgentFormFields.vue'
import AgentConnectionResultBanner from './AgentConnectionResultBanner.vue'
import ParentHostSummary from './ParentHostSummary.vue'
import { updateAgentApi } from '@/services/api/agent-manage.js'

const iconMap = icons
const emit = defineEmits(['refresh'])
const dialog = useDialog()
const editAgentDialog = dialog.visible
const loading = ref(false)
const parentContext = ref(null)
const {
  agent,
  proxyEnabled,
  formRef,
  rules,
  allDisguises,
  urlStrategyEnabled,
  urlStrategyForm,
  paddingEnabled,
  paddingPreset,
  paddingForm,
  headerNoiseEnabled,
  headerNoiseForm,
  tlsFingerprintEnabled,
  tlsFingerprintForm,
  applyPaddingPreset,
  scrollFormToTop,
  buildAgentPayload,
  validateCurrentForm,
  testingConnection,
  testResult,
  testConnection,
  probing,
  handleProbe,
  resetForm,
  loadAgent
} = useAgentForm()

const close = () => {
  dialog.close()
  resetForm()
  parentContext.value = null
}

const openEditAgentDialog = (agentData, parentAgentConfig = null) => {
  dialog.open()
  loadAgent(agentData)
  parentContext.value = parentAgentConfig
}

const handleEdit = async () => {
  if (!await validateCurrentForm()) return

  await executeRequest(
    () => updateAgentApi(buildAgentPayload()),
    {
      loadingRef: loading,
      successMessage: '主机更新成功！',
      errorMessage: '更新失败，请稍后重试',
      onSuccess: () => {
        emit('refresh')
        close()
      }
    }
  )
}

defineExpose({ openEditAgentDialog, close })
</script>

<style scoped>
@import '@/styles/agent-form-dialog-shared.css';
</style>
