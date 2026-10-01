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
          <el-button class="cancel-btn" @click="close"> 取消 </el-button>
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
import { reactive, ref, onMounted, watch } from 'vue'
import { icons } from '@/utils/icons.js'
import { createDefaultAgent } from '@/utils/constants.js'
import { useEditDialog } from '@/utils/dialogUtils.js'
import { validateForm, resetForm as resetFormUtil } from '@/utils/formUtils.js'
import { executeRequest } from '@/utils/apiUtils.js'
import { getAllDisguises } from '@/utils/agentUtils.js'
import { formatHeadersForEditor, stringifyHeadersForSubmit } from '@/utils/headers.js'
import { useAgentStrategies } from '@/composables/useAgentStrategies.js'
import { useAgentUrlProbe } from '@/composables/useAgentUrlProbe.js'
import { useAgentConnectionTest } from '@/composables/useAgentConnectionTest.js'
import AgentFormFields from './AgentFormFields.vue'
import AgentConnectionResultBanner from './AgentConnectionResultBanner.vue'
import ParentHostSummary from './ParentHostSummary.vue'
import { updateAgentApi } from '@/services/api/agent-manage.js'
import { createAgentDialogRules } from '@/components/AgentManager/agentFormShared.js'

const iconMap = icons

const emit = defineEmits(['refresh'])

// 使用编辑对话框工具
const editDialog = useEditDialog()
const editAgentDialog = editDialog.visible

const loading = ref(false)
const proxyEnabled = ref(false)
const formRef = ref(null)
const scrollFormToTop = () => formRef.value?.scrollToTop?.()
const {
  urlStrategyEnabled,
  urlStrategyForm,
  paddingEnabled,
  paddingPreset,
  paddingForm,
  headerNoiseEnabled,
  headerNoiseForm,
  tlsFingerprintEnabled,
  tlsFingerprintForm,
  resetStrategies,
  loadStrategies,
  applyPaddingPreset,
  mergeUrlPoolPaths,
  buildUrlStrategyJson,
  buildPaddingStrategyJson,
  buildHeaderNoiseStrategyJson,
  buildTlsFingerprintStrategyJson
} = useAgentStrategies()

const allDisguises = ref([])
const parentContext = ref(null)

// 使用默认值创建agent对象
const agent = reactive(createDefaultAgent())

const rules = createAgentDialogRules({
  requireDisguises: true,
  requirePayloadKeyForJava: () => agent.type === 'java'
})

const buildAgentPayload = () => ({
  ...agent,
  proxyEnabled: proxyEnabled.value ? 1 : 0,
  headers: stringifyHeadersForSubmit(agent.headers),
  urlStrategy: buildUrlStrategyJson(),
  paddingStrategy: buildPaddingStrategyJson(),
  headerNoiseStrategy: buildHeaderNoiseStrategyJson(),
  tlsFingerprintStrategy: buildTlsFingerprintStrategyJson()
})

const validateCurrentForm = () =>
  validateForm(formRef, { errorMessage: '表单验证失败，请检查输入' })

const {
  testing: testingConnection,
  result: testResult,
  reset: resetConnectionTest,
  testConnection
} = useAgentConnectionTest({ validate: validateCurrentForm, buildPayload: buildAgentPayload })

watch(
  [
    agent,
    proxyEnabled,
    urlStrategyEnabled,
    urlStrategyForm,
    paddingEnabled,
    paddingPreset,
    paddingForm,
    headerNoiseEnabled,
    headerNoiseForm,
    tlsFingerprintEnabled,
    tlsFingerprintForm
  ],
  resetConnectionTest,
  { deep: true }
)

const loadDisguises = async () => {
  allDisguises.value = await getAllDisguises()
}

const resetForm = () => {
  resetFormUtil(formRef, agent, createDefaultAgent())
  proxyEnabled.value = false
  resetStrategies()
  cancelProbe()
  resetConnectionTest()
  parentContext.value = null
}

const close = () => {
  editDialog.close()
  resetForm()
}

const openEditAgentDialog = (agentData, parentAgentConfig = null) => {
  editDialog.open(agentData)
  Object.assign(agent, createDefaultAgent(agentData))
  agent.headers = formatHeadersForEditor(agentData.headers)
  proxyEnabled.value = agent.proxyEnabled == 1
  loadStrategies(agentData)
  resetConnectionTest()
  parentContext.value = parentAgentConfig
}

const {
  probing,
  probePaths: handleProbe,
  cancelProbe
} = useAgentUrlProbe({
  getBaseUrl: () => agent.connLink,
  mergePaths: mergeUrlPoolPaths
})

const handleEdit = async () => {
  // 验证表单
  const isValid = await validateCurrentForm()
  if (!isValid) return

  // 处理表单提交
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

onMounted(() => {
  loadDisguises()
})

defineExpose({
  openEditAgentDialog,
  close
})
</script>

<style scoped>
@import '@/styles/agent-form-dialog-shared.css';
</style>
