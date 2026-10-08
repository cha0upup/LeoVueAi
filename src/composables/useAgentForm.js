import { onMounted, reactive, ref, watch } from 'vue'
import { createAgentDialogRules } from '@/components/AgentManager/agentFormShared.js'
import { createDefaultAgent } from '@/utils/constants.js'
import { validateForm, resetForm as resetFormUtil } from '@/utils/formUtils.js'
import { getAllDisguises } from '@/utils/agentUtils.js'
import { formatHeadersForEditor, stringifyHeadersForSubmit } from '@/utils/headers.js'
import { useAgentStrategies } from './useAgentStrategies.js'
import { useAgentUrlProbe } from './useAgentUrlProbe.js'
import { useAgentConnectionTest } from './useAgentConnectionTest.js'

/** 新增与编辑共用的 Agent 配置表单；对话框和提交操作由调用方管理。 */
export function useAgentForm() {
  const agent = reactive(createDefaultAgent())
  const proxyEnabled = ref(false)
  const formRef = ref(null)
  const allDisguises = ref([])
  const strategies = useAgentStrategies()
  const rules = createAgentDialogRules({
    requireDisguises: true,
    requirePayloadKeyForJava: () => agent.type === 'java'
  })

  const buildAgentPayload = () => ({
    ...agent,
    proxyEnabled: proxyEnabled.value ? 1 : 0,
    headers: stringifyHeadersForSubmit(agent.headers),
    urlStrategy: strategies.buildUrlStrategyJson(),
    paddingStrategy: strategies.buildPaddingStrategyJson(),
    headerNoiseStrategy: strategies.buildHeaderNoiseStrategyJson(),
    tlsFingerprintStrategy: strategies.buildTlsFingerprintStrategyJson()
  })
  const validateCurrentForm = () => validateForm(formRef)
  const {
    testing: testingConnection,
    result: testResult,
    reset: resetConnectionTest,
    testConnection
  } = useAgentConnectionTest({ validate: validateCurrentForm, buildPayload: buildAgentPayload })
  const { probing, probePaths: handleProbe, cancelProbe } = useAgentUrlProbe({
    getBaseUrl: () => agent.connLink,
    mergePaths: strategies.mergeUrlPoolPaths
  })

  watch(
    [
      agent,
      proxyEnabled,
      strategies.urlStrategyEnabled,
      strategies.urlStrategyForm,
      strategies.paddingEnabled,
      strategies.paddingPreset,
      strategies.paddingForm,
      strategies.headerNoiseEnabled,
      strategies.headerNoiseForm,
      strategies.tlsFingerprintEnabled,
      strategies.tlsFingerprintForm
    ],
    resetConnectionTest,
    { deep: true }
  )

  const resetForm = () => {
    resetFormUtil(formRef, agent, createDefaultAgent())
    proxyEnabled.value = false
    strategies.resetStrategies()
    cancelProbe()
    resetConnectionTest()
  }

  const loadAgent = (agentData) => {
    Object.assign(agent, createDefaultAgent(agentData))
    agent.headers = formatHeadersForEditor(agentData.headers)
    proxyEnabled.value = agent.proxyEnabled == 1
    strategies.loadStrategies(agentData)
    resetConnectionTest()
  }

  onMounted(async () => {
    allDisguises.value = await getAllDisguises()
  })

  return {
    agent,
    proxyEnabled,
    formRef,
    rules,
    allDisguises,
    urlStrategyEnabled: strategies.urlStrategyEnabled,
    urlStrategyForm: strategies.urlStrategyForm,
    paddingEnabled: strategies.paddingEnabled,
    paddingPreset: strategies.paddingPreset,
    paddingForm: strategies.paddingForm,
    headerNoiseEnabled: strategies.headerNoiseEnabled,
    headerNoiseForm: strategies.headerNoiseForm,
    tlsFingerprintEnabled: strategies.tlsFingerprintEnabled,
    tlsFingerprintForm: strategies.tlsFingerprintForm,
    applyPaddingPreset: strategies.applyPaddingPreset,
    scrollFormToTop: () => formRef.value?.scrollToTop?.(),
    buildAgentPayload,
    validateCurrentForm,
    resetForm,
    loadAgent,
    testingConnection,
    testResult,
    testConnection,
    probing,
    handleProbe
  }
}
