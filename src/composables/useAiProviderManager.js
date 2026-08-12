import { computed, reactive, ref } from 'vue'

import {
  createAiModelConfigApi,
  createAiProviderApi,
  deleteAiProviderApi,
  fetchAiModelListApi,
  fetchAiProviderModelListApi,
  getAiModelProvidersApi,
  listAiProvidersApi,
  updateAiProviderApi
} from '@/services/api.js'
import { showError, showSuccess } from '@/utils/messageUtils.js'
import {
  AI_PROTOCOL,
  DEFAULT_COMPLETIONS_PATH,
  createProviderForm,
  defaultPathForProtocol,
  normalizeProtocol,
  resetReactiveForm
} from '@/components/Settings/aiChannelSettingsModel.js'

const PROVIDER_RULES = {
  name: [{ required: true, message: '请输入供应商名称', trigger: 'blur' }],
  baseUrl: [{ required: true, message: '请输入 Base URL', trigger: 'blur' }],
  apiKey: [{ required: true, message: '请输入 API Key', trigger: 'blur' }]
}

/**
 * AI 供应商配置、模型发现和同步逻辑。
 */
export function useAiProviderManager({
  modelRows,
  loadModels,
  ensureCapabilitiesLoaded,
  findCapabilityByModelName,
  testConnection
}) {
  const providers = ref([])
  const savedProviders = ref([])
  const selectedProviderKey = ref('')
  const fetchingModels = ref(false)
  const providerDefaultModelIndex = ref(0)
  const syncingProviderId = ref(null)
  const providerDialogVisible = ref(false)
  const providerEditing = ref(null)
  const providerHeadersTouched = ref(false)
  const providerFormRef = ref(null)
  const providerSaveLoading = ref(false)
  const providerForm = reactive(createProviderForm())

  const providerHeadersPlaceholder = computed(() =>
    providerEditing.value?.headersConfigured
      ? '已配置；留空表示保留，输入新 JSON 将整体替换'
      : '如 {"HTTP-Referer":"https://example.com"}'
  )

  const loadProviders = async () => {
    try {
      const data = (await getAiModelProvidersApi()).data
      providers.value = Array.isArray(data) ? data : []
    } catch {
      providers.value = []
    }
  }

  const loadSavedProviders = async () => {
    try {
      const data = (await listAiProvidersApi()).data
      savedProviders.value = Array.isArray(data) ? data : []
    } catch (error) {
      showError(error?.message || '加载供应商失败')
    }
  }

  const resetProviderForm = (initial = createProviderForm()) => {
    resetReactiveForm(providerForm, initial)
  }

  const selectProviderPreset = (provider) => {
    selectedProviderKey.value = provider.key
    providerForm.providerKey = provider.key || 'custom'
    providerForm.name = provider.label || ''
    if (provider.key !== 'custom') providerForm.baseUrl = provider.baseUrl
    providerForm.protocol =
      provider.protocol ||
      (provider.key === 'openai' ? AI_PROTOCOL.responses : AI_PROTOCOL.chatCompletions)
    providerForm.completionsPath =
      provider.completionsPath || defaultPathForProtocol(providerForm.protocol)
    providerForm.models = []
    providerDefaultModelIndex.value = 0
  }

  const fetchProviderFormModels = async () => {
    if (!providerForm.baseUrl || !providerForm.apiKey) {
      showError('请先填写 Base URL 和 API Key')
      return
    }

    fetchingModels.value = true
    try {
      const data = (
        await fetchAiModelListApi({
          baseUrl: providerForm.baseUrl,
          apiKey: providerForm.apiKey,
          completionsPath: providerForm.completionsPath || DEFAULT_COMPLETIONS_PATH
        })
      ).data
      if (!Array.isArray(data) || data.length === 0) {
        showError('未获取到模型列表，请检查供应商配置')
        return
      }
      providerForm.models = data.map((model) => ({ model, name: model, checked: true }))
      providerDefaultModelIndex.value = 0
      showSuccess(`获取到 ${data.length} 个模型`)
    } catch (error) {
      showError(error?.message || '获取模型列表失败')
    } finally {
      fetchingModels.value = false
    }
  }

  const addManualProviderModel = () => {
    providerForm.models.push({ model: '', name: '', checked: true })
  }

  const openProviderCreate = () => {
    providerEditing.value = null
    providerHeadersTouched.value = false
    selectedProviderKey.value = ''
    providerDefaultModelIndex.value = 0
    resetProviderForm()
    providerDialogVisible.value = true
  }

  const openProviderEdit = (provider) => {
    providerEditing.value = provider
    providerHeadersTouched.value = false
    selectedProviderKey.value = provider.providerKey || ''
    resetProviderForm({
      name: provider.name || '',
      providerKey: provider.providerKey || 'custom',
      baseUrl: provider.baseUrl || 'https://api.openai.com/v1',
      apiKey: '',
      protocol: normalizeProtocol(provider.protocol),
      completionsPath: provider.completionsPath || defaultPathForProtocol(provider.protocol),
      headersJson: '',
      remark: provider.remark || '',
      enabledBool: provider.enabled !== 0,
      models: []
    })
    providerDialogVisible.value = true
  }

  const buildProviderModelPayloads = () => {
    const selected = providerForm.models
      .map((item, index) => ({ ...item, index }))
      .filter((item) => item.checked && item.model?.trim())
    if (selected.length === 0) return []

    const selectedDefaultIndex = selected.findIndex(
      (item) => item.index === providerDefaultModelIndex.value
    )
    const defaultIndex = selectedDefaultIndex >= 0 ? selectedDefaultIndex : 0
    return selected.map((item, index) => {
      const model = item.model.trim()
      return {
        name: (item.name || model).trim(),
        model,
        reasoningEffort: 'auto',
        enabled: 1,
        isActive: modelRows.value.length === 0 && index === defaultIndex ? 1 : 0
      }
    })
  }

  const buildProviderBody = (includeModels = false) => {
    const body = {
      name: providerForm.name.trim(),
      providerKey: providerForm.providerKey || 'custom',
      baseUrl: providerForm.baseUrl.trim(),
      protocol: normalizeProtocol(providerForm.protocol),
      completionsPath: (
        providerForm.completionsPath || defaultPathForProtocol(providerForm.protocol)
      ).trim(),
      remark: providerForm.remark || '',
      enabled: providerForm.enabledBool ? 1 : 0
    }
    const apiKey = providerForm.apiKey?.trim()
    if (apiKey) body.apiKey = apiKey
    if (!providerEditing.value || providerHeadersTouched.value) {
      body.headersJson = providerForm.headersJson?.trim() || null
    }
    if (includeModels) body.models = buildProviderModelPayloads()
    return body
  }

  const submitProvider = async () => {
    try {
      await providerFormRef.value?.validate()
    } catch {
      return false
    }

    providerSaveLoading.value = true
    try {
      if (providerEditing.value) {
        await updateAiProviderApi(providerEditing.value.id, buildProviderBody())
        showSuccess('供应商已保存')
      } else {
        await ensureCapabilitiesLoaded()
        const body = buildProviderBody(true)
        const unknown = (body.models || []).filter(
          (item) => !findCapabilityByModelName(item.model, providerForm.providerKey)
        )
        await createAiProviderApi(body)
        showSuccess(
          unknown.length
            ? `供应商已新增；${unknown.length} 个未收录模型将按保守默认能力调用`
            : '供应商已新增'
        )
      }
      providerDialogVisible.value = false
      await Promise.all([loadSavedProviders(), loadModels()])
      return true
    } catch (error) {
      showError(error?.message || '保存供应商失败')
      return false
    } finally {
      providerSaveLoading.value = false
    }
  }

  const removeProvider = async (provider) => {
    if (!provider?.id) return false
    try {
      await deleteAiProviderApi(provider.id)
      showSuccess('供应商已删除')
      await Promise.all([loadSavedProviders(), loadModels()])
      return true
    } catch (error) {
      showError(error?.message || '删除供应商失败')
      return false
    }
  }

  const testProvider = async (provider) => {
    const model = provider.models.find((item) => item.enabled !== 0) || provider.models[0]
    if (!model) {
      showError('该供应商下暂无可测试模型，请先同步模型')
      return false
    }
    await testConnection(model)
    return true
  }

  const syncProviderModels = async (provider) => {
    if (!provider.id) return false
    syncingProviderId.value = provider.id
    try {
      await ensureCapabilitiesLoaded()
      const data = (await fetchAiProviderModelListApi(provider.id)).data
      if (!Array.isArray(data) || data.length === 0) {
        showError('未获取到模型列表，请检查供应商配置')
        return false
      }

      const unknownCount = data.filter(
        (model) => !findCapabilityByModelName(model, provider.providerKey)
      ).length
      const existing = new Set(provider.models.map((item) => item.model))
      const missing = data.filter((model) => !existing.has(model))
      for (const model of missing) {
        await createAiModelConfigApi({
          providerId: provider.id,
          name: model,
          model,
          reasoningEffort: 'auto',
          enabled: 1,
          isActive: modelRows.value.length === 0 ? 1 : 0
        })
      }
      const unknownText = unknownCount ? `；${unknownCount} 个未收录模型使用保守默认能力` : ''
      showSuccess(
        missing.length
          ? `已同步 ${missing.length} 个新模型${unknownText}`
          : `模型列表已是最新${unknownText}`
      )
      await loadModels()
      return true
    } catch (error) {
      showError(error?.message || '同步模型失败')
      return false
    } finally {
      syncingProviderId.value = null
    }
  }

  return {
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
    providerRules: PROVIDER_RULES,
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
  }
}
