<template>
  <div class="ai-model-settings">
    <PageHeader
      title="AI 模型接入"
      :icon="iconMap.settings"
    >
      <template #actions>
        <el-button
          type="primary"
          @click="openProviderCreate"
        >
          <el-icon><Icon :icon="iconMap.add" /></el-icon>
          新增供应商
        </el-button>
      </template>
    </PageHeader>
    <section
      ref="accessLayoutRef"
      class="access-layout"
    >
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
      />

      <AiModelDetailPanel
        :model="selectedModel"
        :model-health-by-id="modelHealthById"
        :probing-id="probingId"
        :activating-id="activatingId"
        @edit="openEdit"
        @probe="probeCapabilities"
        @activate="activate"
        @back="focusCatalog"
      />
    </section>

    <AiModelConfigDialog
      v-model="dialogVisible"
      :form-state="form"
      :rules="rules"
      :saved-providers="savedProviders"
      :fallback-candidates="fallbackCandidates"
      :reasoning-mode-options="reasoningModeOptions"
      :reasoning-options="reasoningOptions"
      :inherited-endpoint-label="inheritedEndpointLabel"
      :model-limit-hint="modelLimitHint"
      :reasoning-capability-hint="reasoningCapabilityHint"
      :temperature-configurable="requestControls.temperatureConfigurable"
      :parameter-rules="requestControls.parameterRules"
      :request-preview="requestPreview"
      :preview-loading="previewLoading"
      :preview-error="previewError"
      :save-loading="saveLoading"
      @submit="submit"
      @form-ready="formRef = $event"
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
      @form-ready="providerFormRef = $event"
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
      @form-ready="capabilityFormRef = $event"
    />

    <AiCapabilityProbeDialog
      v-model="probeResultDialogVisible"
      :report="latestProbeReport"
    />
  </div>
</template>

<script setup>
import { icons as iconMap } from '@/utils/icons.js'
import PageHeader from '@/components/common/PageHeader.vue'
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'

import {
  listAiModelConfigsApi,
  updateAiModelConfigApi,
  activateAiModelConfigApi,
  testAiModelConfigConnectionApi,
  probeAiModelCapabilitiesApi,
  listAiModelHealthApi
} from '@/services/api/admin.js'
import { showError, showSuccess } from '@/utils/messageUtils.js'
import AiCapabilityRegistryDialogs from './AiCapabilityRegistryDialogs.vue'
import AiCapabilityProbeDialog from './AiCapabilityProbeDialog.vue'
import AiModelConfigDialog from './AiModelConfigDialog.vue'
import AiModelDetailPanel from './AiModelDetailPanel.vue'
import AiProviderCatalog from './AiProviderCatalog.vue'
import AiProviderDialog from './AiProviderDialog.vue'
import { useAiCapabilityRegistry } from '@/composables/useAiCapabilityRegistry.js'
import { useAiProviderManager } from '@/composables/useAiProviderManager.js'
import { useAiModelRequestPreview } from '@/composables/useAiModelRequestPreview.js'
import {
  AI_PROTOCOL_OPTIONS as protocolOptions,
  DEFAULT_COMPLETIONS_PATH as DEFAULT_PATH,
  modelRequestControls,
  createModelForm,
  defaultPathForProtocol,
  probeSummary,
  resetReactiveForm
} from './aiChannelSettingsModel.js'

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

// Initialize dialog state before watchers evaluate their computed sources.
const dialogVisible = ref(false)
const editing = ref(null)
const formRef = ref(null)
const saveLoading = ref(false)
const form = reactive(createModelForm())
const rules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  model: [{ required: true, message: '请输入模型名称', trigger: 'blur' }]
}

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
} = useAiCapabilityRegistry({ onChanged: loadList })

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
  loadModels: loadList,
  ensureCapabilitiesLoaded,
  findCapabilityByModelName,
  testConnection
})

const selectedModel = computed(() => rows.value.find((item) => item.id === selectedModelId.value) || rows.value.find((item) => item.isActive === 1) || rows.value[0] || null)
const inheritedEndpointLabel = computed(() => {
  const provider = form.baseUrl && form.completionsPath
    ? null
    : savedProviders.value.find((p) => p.id === form.providerId)
  const baseUrl = form.baseUrl || provider?.baseUrl || ''
  const path = form.completionsPath || provider?.completionsPath || DEFAULT_PATH
  if (!baseUrl) return '选择供应商后自动继承'
  return `${baseUrl}${path}`
})
const modelLimitHint = computed(() => {
  const hasCustomContext = Number(form.contextWindowTokens || 0) > 0
  const hasCustomOutput = Number(form.maxOutputTokens || 0) > 0
  return hasCustomContext || hasCustomOutput
    ? '自定义值会在后端按模型真实能力上限自动裁剪'
    : '默认使用系统能力库识别出的模型上限'
})
const { preview: requestPreview, loading: previewLoading, error: previewError, refresh: previewRequest } =
  useAiModelRequestPreview({ visible: dialogVisible, form })
const baseRequestControls = computed(() => modelRequestControls(
  findCapabilityByModelName(form.model, form.providerKey), form.providerKey, form.thinkingEnabled
))
const requestControls = computed(() => requestPreview.value?.contract
  ? modelRequestControls({ requestOptions: requestPreview.value.contract }, form.providerKey, form.thinkingEnabled)
  : baseRequestControls.value)
const reasoningOptions = computed(() => requestControls.value.reasoningOptions)
const reasoningModeOptions = computed(() => requestControls.value.reasoningModeOptions)
watch(requestControls, (controls) => {
  if (controls.reasoningContractAvailable && !controls.reasoningOptions.some(option => option.value === form.reasoningEffort)) {
    form.reasoningEffort = 'auto'
  }
  if (controls.thinkingRequired && form.thinkingEnabled === 0) form.thinkingEnabled = null
})
const reasoningCapabilityHint = computed(() => {
  if (requestControls.value.thinkingRequired) return '该模型始终开启思考；可用等级按官方参数约束显示。'
  if (requestControls.value.responsesRequiredForTools) return '使用工具调用时请选择 Responses API。'
  return '厂商默认不发送独立开关；显式开启或关闭的转换结果请查看下方实际生效参数。'
})
const fallbackCandidates = computed(() => rows.value.filter((candidate) => (
  candidate.id !== editing.value?.id
  && candidate.enabled !== 0
  && candidate.supportsTextGeneration !== false
  && candidate.supportsStreaming !== false
)))

const accessLayoutRef = ref(null)

async function selectModel(model) {
  selectedModelId.value = model.id
  await nextTick()
  const layout = accessLayoutRef.value
  if (!layout?.querySelector || window.getComputedStyle(layout).gridTemplateColumns.split(' ').length !== 1) return
  const detail = layout.querySelector('.model-detail-panel')
  detail?.scrollIntoView({ block: 'start' })
  detail?.focus({ preventScroll: true })
}

function focusCatalog() {
  const selected = accessLayoutRef.value?.querySelector?.('.model-row-lite[aria-pressed="true"]')
  selected?.scrollIntoView({ block: 'center' })
  selected?.focus({ preventScroll: true })
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

// ── Dialog actions ─────────────────────────────────────────────────────
function openEdit(row) {
  editing.value = row
  resetReactiveForm(form, {
    name: row.name || '',
    providerId: row.providerId || null,
    providerKey: row.providerKey || 'custom',
    providerName: row.providerName || '',
    baseUrl: row.baseUrl || '',
    model: row.model || '',
    completionsPath: row.completionsPath || defaultPathForProtocol(row.protocol),
    thinkingEnabled: row.thinkingEnabled ?? null,
    reasoningEffort: row.reasoningEffort || 'auto',
    maxOutputTokens: row.maxOutputTokens ?? null,
    contextWindowTokens: row.contextWindowTokens ?? null,
    temperature: row.temperature ?? null,
    fallbackModelId: row.fallbackModelId ?? null,
    remark: row.remark || '',
    enabledBool: row.enabled !== 0,
    isActiveBool: row.isActive === 1
  })
  dialogVisible.value = true
}

function buildBody() {
  return {
    name: form.name.trim(),
    providerId: form.providerId,
    model: form.model.trim(),
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
}

async function submit() {
  const editingId = editing.value?.id
  if (editingId == null) return
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  saveLoading.value = true
  try {
    await ensureCapabilitiesLoaded()
    const preview = await previewRequest()
    if (!dialogVisible.value || editingId !== editing.value?.id) return
    if (!preview) {
      if (previewError.value) showError(previewError.value)
      return
    }
    if (requestPreview.value !== preview) return
    if (!preview.valid) {
      showError(preview.errors?.[0]?.message || '请检查模型参数后再保存')
      return
    }
    const unknownModel = !findCapabilityByModelName(form.model, form.providerKey)
    await updateAiModelConfigApi(editingId, buildBody())
    showSuccess(unknownModel ? '已保存；该模型将按保守默认能力调用' : '已保存')
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
  container: ai-settings / inline-size;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-height: 100%;
  padding: 0;
  background: var(--el-bg-color-page);
}

.access-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 360px);
  gap: var(--space-4);
  align-items: stretch;
}

@container ai-settings (max-width: 1100px) {
  .access-layout {
    grid-template-columns: 1fr;
  }
}
</style>
