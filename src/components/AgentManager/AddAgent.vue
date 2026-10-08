<template>
  <el-dialog
    v-model="addAgentDialog"
    width="900px"
    top="4vh"
    draggable
    class="agent-dialog add-agent-dialog"
    @opened="scrollFormToTop"
    @close="close"
  >
    <template #header>
      <div class="dialog-intro dialog-header-intro">
        <div class="intro-main">
          <div class="intro-title-row">
            <el-icon class="intro-icon">
              <Icon :icon="iconMap.server" />
            </el-icon>
            <div>
              <h3>新建主机节点</h3>
            </div>
          </div>
        </div>
      </div>
    </template>

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
      @submit="handleSubmit"
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
            @click="handleSubmit"
          >
            <el-icon><Icon :icon="iconMap.check" /></el-icon>
            {{ loading ? '添加中...' : '添加主机' }}
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
import { addAgentApi } from '@/services/api/agent-manage.js'

const iconMap = icons
const props = defineProps({
  projectId: { type: String, default: '' }
})
const emit = defineEmits(['refresh'])
const dialog = useDialog()
const addAgentDialog = dialog.visible
const loading = ref(false)
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
  resetForm
} = useAgentForm()

const close = () => {
  dialog.close()
  resetForm()
}

const handleSubmit = async () => {
  if (!await validateCurrentForm()) return

  await executeRequest(
    () => addAgentApi(buildAgentPayload(), { projectId: props.projectId }),
    {
      loadingRef: loading,
      successMessage: '主机添加成功！',
      errorMessage: '添加失败，请稍后重试',
      onSuccess: () => {
        emit('refresh')
        close()
      }
    }
  )
}

const openAddAgent = () => {
  dialog.open()
  resetForm()
}

defineExpose({ openAddAgent, close })
</script>

<style scoped>
@import '@/styles/agent-form-dialog-shared.css';
</style>
