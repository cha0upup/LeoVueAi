<template>
  <div class="ai-model-settings">
    <section class="access-layout">
      <AiProviderCatalog
        v-model:search-keyword="searchKeyword"
        :saved-providers="savedProviders"
        :rows="rows"
        :model-health-by-id="modelHealthById"
        :selected-model-id="selectedModelId"
        :loading="listLoading"
        :testing-model-id="testingId"
        :syncing-provider-id="syncingProviderId"
        @open-capabilities="openCapabilityManager"
        @refresh="refreshAll"
        @test-provider="testProvider"
        @sync-provider="syncProviderModels"
        @edit-provider="openProviderEdit"
        @remove-provider="removeProvider"
        @select-model="selectModel"
        @create-provider="openProviderCreate"
      />

      <AiModelDetailPanel
        :model="selectedModel"
        :model-health-by-id="modelHealthById"
        :probing-id="probingId"
        :activating-id="activatingId"
        @edit="openEdit"
        @probe="probeCapabilities"
        @activate="activate"
      />
    </section>

    <AiModelConfigDialog
      v-model="dialogVisible"
      :editing="editing"
      :form-state="form"
      :rules="rules"
      :saved-providers="savedProviders"
      :fallback-candidates="fallbackCandidates"
      :reasoning-mode-options="reasoningModeOptions"
      :reasoning-options="reasoningOptions"
      :inherited-endpoint-label="inheritedEndpointLabel"
      :model-limit-hint="modelLimitHint"
      :reasoning-capability-hint="reasoningCapabilityHint"
      :save-loading="saveLoading"
      @apply-provider="applySelectedProvider"
      @submit="submit"
      @form-ready="setModelFormRef"
    />

    <AiProviderDialog
      v-model="providerDialogVisible"
      v-model:selected-provider-key="selectedProviderKey"
      v-model:headers-touched="providerHeadersTouched"
      v-model:default-model-index="providerDefaultModelIndex"
      :editing="providerEditing"
      :form-state="providerForm"
      :rules="providerRules"
      :providers="providers"
      :protocol-options="protocolOptions"
      :headers-placeholder="providerHeadersPlaceholder"
      :fetching-models="fetchingModels"
      :save-loading="providerSaveLoading"
      @select-preset="selectProviderPreset"
      @fetch-models="fetchProviderFormModels"
      @add-model="addManualProviderModel"
      @submit="submitProvider"
      @form-ready="setProviderFormRef"
    />

    <AiCapabilityRegistryDialogs
      v-model:manager-visible="capabilityDialogVisible"
      v-model:form-visible="capabilityFormVisible"
      v-model:search-keyword="capabilitySearchKeyword"
      :items="filteredCapabilities"
      :loading="capabilityLoading"
      :editing="capabilityEditing"
      :form-state="capabilityForm"
      :rules="capabilityRules"
      :save-loading="capabilitySaveLoading"
      @load="loadCapabilities"
      @create="openCapabilityCreate"
      @edit="openCapabilityEdit"
      @remove="removeCapability"
      @submit="submitCapability"
      @form-ready="setCapabilityFormRef"
    />

    <AiCapabilityProbeDialog
      v-model="probeResultDialogVisible"
      :report="latestProbeReport"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'

import {
  listAiModelConfigsApi,
  createAiModelConfigApi,
  updateAiModelConfigApi,
  activateAiModelConfigApi,
  testAiModelConfigConnectionApi,
  probeAiModelCapabilitiesApi,
  listAiModelHealthApi
} from '@/services/api.js'
import { showError, showSuccess } from '@/utils/messageUtils.js'
import AiCapabilityRegistryDialogs from './AiCapabilityRegistryDialogs.vue'
import AiCapabilityProbeDialog from './AiCapabilityProbeDialog.vue'
import AiModelConfigDialog from './AiModelConfigDialog.vue'
import AiModelDetailPanel from './AiModelDetailPanel.vue'
import AiProviderCatalog from './AiProviderCatalog.vue'
import AiProviderDialog from './AiProviderDialog.vue'
import { useAiCapabilityRegistry } from '@/composables/useAiCapabilityRegistry.js'
import { useAiProviderManager } from '@/composables/useAiProviderManager.js'
import {
  AI_PROTOCOL_OPTIONS,
  DEFAULT_COMPLETIONS_PATH,
  REASONING_EFFORT_OPTIONS,
  REASONING_MODE_OPTIONS,
  createModelForm,
  defaultPathForProtocol,
  normalizeProtocol,
  probeSummary,
  resetReactiveForm
} from './aiChannelSettingsModel.js'

const DEFAULT_PATH = DEFAULT_COMPLETIONS_PATH
const protocolOptions = AI_PROTOCOL_OPTIONS
const reasoningModeOptions = REASONING_MODE_OPTIONS
const reasoningOptions = REASONING_EFFORT_OPTIONS

// ── List state ─────────────────────────────────────────────────────────
const rows = ref([])
const listLoading = ref(false)
const searchKeyword = ref('')
const activatingId = ref(null)
const testingId = ref(null)
const probingId = ref(null)
const probeResultDialogVisible = ref(false)
const latestProbeReport = ref(null)
const selectedModelId = ref(null)
const modelHealthById = ref({})
const {
  capabilityDialogVisible,
  capabilityLoading,
  capabilitySearchKeyword,
  capabilityFormVisible,
  capabilityEditing,
  capabilityFormRef,
  capabilitySaveLoading,
  capabilityForm,
  capabilityRules,
  filteredCapabilities,
  loadCapabilities,
  ensureCapabilitiesLoaded,
  openCapabilityManager,
  openCapabilityCreate,
  openCapabilityEdit,
  submitCapability,
  removeCapability,
  findCapabilityByModelName
} = useAiCapabilityRegistry({ onChanged: () => loadList() })

const setCapabilityFormRef = (instance) => {
  capabilityFormRef.value = instance
}

const {
  providers,
  savedProviders,
  selectedProviderKey,
  fetchingModels,
  providerDefaultModelIndex,
  syncingProviderId,
  providerDialogVisible,
  providerEditing,
  providerHeadersTouched,
  providerHeadersPlaceholder,
  providerFormRef,
  providerSaveLoading,
  providerForm,
  providerRules,
  loadProviders,
  loadSavedProviders,
  selectProviderPreset,
  fetchProviderFormModels,
  addManualProviderModel,
  openProviderCreate,
  openProviderEdit,
  submitProvider,
  removeProvider,
  testProvider,
  syncProviderModels
} = useAiProviderManager({
  modelRows: rows,
  loadModels: () => loadList(),
  ensureCapabilitiesLoaded,
  findCapabilityByModelName,
  testConnection: (model) => testConnection(model)
})

const setProviderFormRef = (instance) => {
  providerFormRef.value = instance
}

const selectedModel = computed(() => rows.value.find((item) => item.id === selectedModelId.value) || rows.value.find((item) => item.isActive === 1) || rows.value[0] || null)
const inheritedEndpointLabel = computed(() => {
  const baseUrl = form.baseUrl || savedProviders.value.find((p) => p.id === form.providerId)?.baseUrl || ''
  const path = form.completionsPath || savedProviders.value.find((p) => p.id === form.providerId)?.completionsPath || DEFAULT_PATH
  if (!baseUrl) return '选择供应商后自动继承'
  return `${baseUrl}${path || ''}`
})
const modelLimitHint = computed(() => {
  const hasCustomContext = Number(form.contextWindowTokens || 0) > 0
  const hasCustomOutput = Number(form.maxOutputTokens || 0) > 0
  if (!hasCustomContext && !hasCustomOutput) {
    return '默认使用系统能力库识别出的模型上限'
  }
  return '自定义值会在后端按模型真实能力上限自动裁剪'
})
const reasoningCapabilityHint = computed(() => {
  if (form.thinkingEnabled === 1 && editing.value && !editing.value.supportsReasoning) {
    return '当前能力库认为该模型不支持 Reasoning，保存后可能会被后端忽略。'
  }
  return '开启后仍受模型能力限制；不支持 Reasoning 的模型会被后端忽略。'
})
const fallbackCandidates = computed(() => rows.value.filter((candidate) => (
  candidate.id !== editing.value?.id
  && candidate.enabled !== 0
  && candidate.supportsTextGeneration !== false
  && candidate.supportsStreaming !== false
)))

function selectModel(model) {
  selectedModelId.value = model.id
}

async function loadList() {
  listLoading.value = true
  try {
    const res = await listAiModelConfigsApi()
    const data = res.data
    rows.value = Array.isArray(data) ? data : []
    if (!selectedModelId.value || !rows.value.some((item) => item.id === selectedModelId.value)) {
      selectedModelId.value = rows.value.find((item) => item.isActive === 1)?.id || rows.value[0]?.id || null
    }
  } catch (e) {
    showError(e?.message || '加载失败')
  } finally {
    listLoading.value = false
  }
}

async function loadModelHealth() {
  try {
    const res = await listAiModelHealthApi()
    const list = res.data
    modelHealthById.value = Array.isArray(list)
      ? Object.fromEntries(list.filter((item) => item?.configId != null).map((item) => [item.configId, item]))
      : {}
  } catch {
    modelHealthById.value = {}
  }
}

async function refreshAll() {
  listLoading.value = true
  try {
    await Promise.all([loadSavedProviders(), loadList(), loadCapabilities(), loadModelHealth()])
  } finally {
    listLoading.value = false
  }
}

// ── Dialog state ───────────────────────────────────────────────────────
const dialogVisible = ref(false)
const editing = ref(null)
const formRef = ref(null)
const saveLoading = ref(false)

const form = reactive(createModelForm())
const rules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  providerId: [{ required: true, message: '请选择供应商', trigger: 'change' }],
  model: [{ required: true, message: '请输入模型名称', trigger: 'blur' }]
}

const setModelFormRef = (instance) => {
  formRef.value = instance
}

function resetForm(initial = createModelForm()) {
  resetReactiveForm(form, initial)
}

function openEdit(row) {
  editing.value = row
  resetForm({
    name: row.name || '',
    providerId: row.providerId || null,
    providerKey: row.providerKey || 'custom',
    providerName: row.providerName || '',
    baseUrl: row.baseUrl || '',
    apiKey: '',
    model: row.model || '',
    protocol: normalizeProtocol(row.protocol),
    completionsPath: row.completionsPath || defaultPathForProtocol(row.protocol),
    thinkingEnabled: row.thinkingEnabled ?? null,
    reasoningEffort: row.reasoningEffort || 'auto',
    maxOutputTokens: row.maxOutputTokens ?? null,
    contextWindowTokens: row.contextWindowTokens ?? null,
    temperature: row.temperature ?? null,
    fallbackModelId: row.fallbackModelId ?? null,
    headersJson: '',
    remark: row.remark || '',
    enabledBool: row.enabled !== 0,
    isActiveBool: row.isActive === 1
  })
  selectedProviderKey.value = row.providerKey || ''
  dialogVisible.value = true
}

function applySelectedProvider() {
  const provider = savedProviders.value.find((p) => p.id === form.providerId)
  if (!provider) return
  form.providerKey = provider.providerKey || 'custom'
  form.providerName = provider.name || ''
  form.baseUrl = provider.baseUrl || ''
  form.protocol = normalizeProtocol(provider.protocol)
  form.completionsPath = provider.completionsPath || defaultPathForProtocol(provider.protocol)
  form.headersJson = ''
}

function buildBody() {
  const body = {
    name: form.name.trim(),
    providerId: form.providerId,
    providerKey: form.providerKey || 'custom',
    providerName: form.providerName?.trim() || null,
    baseUrl: form.baseUrl.trim(),
    model: form.model.trim(),
    protocol: normalizeProtocol(form.protocol),
    completionsPath: (form.completionsPath || defaultPathForProtocol(form.protocol)).trim(),
    thinkingEnabled: form.thinkingEnabled,
    reasoningEffort: form.reasoningEffort || 'auto',
    maxOutputTokens: form.maxOutputTokens || null,
    contextWindowTokens: form.contextWindowTokens || null,
    temperature: form.temperature ?? null,
    fallbackModelId: form.fallbackModelId || null,
    remark: form.remark || '',
    enabled: form.enabledBool ? 1 : 0,
    isActive: form.isActiveBool ? 1 : 0
  }
  return body
}

async function submit() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  saveLoading.value = true
  try {
    await ensureCapabilitiesLoaded()
    const unknownModel = !findCapabilityByModelName(form.model, form.providerKey)
    if (editing.value) {
      await updateAiModelConfigApi(editing.value.id, buildBody())
      showSuccess(unknownModel ? '已保存；该模型将按保守默认能力调用' : '已保存')
    } else {
      await createAiModelConfigApi(buildBody())
      showSuccess(unknownModel ? '已新增；该模型将按保守默认能力调用' : '已新增')
    }
    dialogVisible.value = false
    await loadList()
  } catch (e) {
    showError(e?.message || '保存失败')
  } finally {
    saveLoading.value = false
  }
}

// ── Row actions ────────────────────────────────────────────────────────
async function activate(row) {
  activatingId.value = row.id
  try {
    await activateAiModelConfigApi(row.id)
    showSuccess('已设为默认模型')
    await loadList()
  } catch (e) {
    showError(e?.message || '设置默认失败')
  } finally {
    activatingId.value = null
  }
}

async function testConnection(row) {
  testingId.value = row.id
  try {
    const res = await testAiModelConfigConnectionApi(row.id)
    const data = res.data || {}
    if (data.success) {
      showSuccess(`连通正常 (${data.latencyMs} ms)`)
    } else {
      showError(`测试失败: ${data.message || data.category || '未知错误'}`)
    }
  } catch (e) {
    showError(e?.message || '测试失败')
  } finally {
    testingId.value = null
    await loadModelHealth()
  }
}

async function probeCapabilities(row) {
  probingId.value = row.id
  try {
    const res = await probeAiModelCapabilitiesApi(row.id)
    const data = res.data || {}
    latestProbeReport.value = data
    probeResultDialogVisible.value = true
    const summary = probeSummary(data.items)
    if (data.applied) {
      showSuccess(`真实探测完成，已更新能力库：${summary}`)
    } else {
      showError(`基础文本探测未通过，未修改能力库：${summary}`)
    }
    await Promise.all([loadList(), loadCapabilities(), loadModelHealth()])
  } catch (e) {
    showError(e?.message || '真实探测失败')
  } finally {
    probingId.value = null
  }
}

onMounted(() => {
  loadProviders()
  refreshAll()
})
</script>

<style scoped>
.ai-model-settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-height: 100%;
  padding: 0;
  background: var(--el-bg-color-page);
}

.access-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  gap: var(--space-4);
  align-items: stretch;
}

@media (max-width: 720px) {
  .access-layout {
    grid-template-columns: 1fr;
  }
}
</style>
