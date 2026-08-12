import { computed, reactive, ref } from 'vue'

import {
  createAiModelCapabilityApi,
  deleteAiModelCapabilityApi,
  listAiModelCapabilitiesApi,
  updateAiModelCapabilityApi
} from '@/services/api.js'
import { showError, showSuccess } from '@/utils/messageUtils.js'
import {
  buildCapabilityBody,
  capabilityIdentityLabel,
  capabilityToForm,
  createCapabilityForm,
  normalizeCapabilityKey,
  normalizeModelNameForCapability,
  resetReactiveForm
} from '@/components/Settings/aiChannelSettingsModel.js'

const CAPABILITY_RULES = {
  modelName: [{ required: true, message: '请输入模型 ID', trigger: 'blur' }],
  contextWindowTokens: [{ required: true, message: '请输入上下文窗口', trigger: 'blur' }],
  maxOutputTokens: [{ required: true, message: '请输入最大输出长度', trigger: 'blur' }]
}

/**
 * 模型能力库的加载、过滤、编辑和持久化边界。
 */
export function useAiCapabilityRegistry({ onChanged = async () => {} } = {}) {
  const capabilities = ref([])
  const capabilityDialogVisible = ref(false)
  const capabilityLoading = ref(false)
  const capabilitySearchKeyword = ref('')
  const capabilityFormVisible = ref(false)
  const capabilityEditing = ref(null)
  const capabilityFormRef = ref(null)
  const capabilitySaveLoading = ref(false)
  const capabilityForm = reactive(createCapabilityForm())

  const filteredCapabilities = computed(() => {
    const query = capabilitySearchKeyword.value.trim().toLowerCase()
    if (!query) return capabilities.value
    return capabilities.value.filter((item) =>
      [item.modelName, item.source, item.remark].some((value) =>
        String(value || '')
          .toLowerCase()
          .includes(query)
      )
    )
  })

  const loadCapabilities = async () => {
    capabilityLoading.value = true
    try {
      const data = (await listAiModelCapabilitiesApi()).data
      capabilities.value = Array.isArray(data) ? data : []
      return capabilities.value
    } catch (error) {
      showError(error?.message || '加载能力库失败')
      return []
    } finally {
      capabilityLoading.value = false
    }
  }

  const ensureCapabilitiesLoaded = async () => {
    if (capabilities.value.length === 0) {
      await loadCapabilities()
    }
    return capabilities.value
  }

  const openCapabilityManager = async () => {
    capabilityDialogVisible.value = true
    await ensureCapabilitiesLoaded()
  }

  const resetCapabilityForm = (initial = createCapabilityForm()) => {
    resetReactiveForm(capabilityForm, initial)
  }

  const openCapabilityCreate = () => {
    capabilityEditing.value = null
    resetCapabilityForm()
    capabilityFormVisible.value = true
  }

  const openCapabilityEdit = (row) => {
    capabilityEditing.value = row
    resetCapabilityForm(capabilityToForm(row))
    capabilityFormVisible.value = true
  }

  const submitCapability = async () => {
    try {
      await capabilityFormRef.value?.validate()
    } catch {
      return false
    }

    capabilitySaveLoading.value = true
    try {
      const body = buildCapabilityBody(capabilityForm)
      if (capabilityEditing.value) {
        await updateAiModelCapabilityApi(capabilityEditing.value.modelName, body)
        showSuccess('模型能力已保存')
      } else {
        await createAiModelCapabilityApi(body)
        showSuccess('模型能力已新增')
      }
      capabilityFormVisible.value = false
      await loadCapabilities()
      await onChanged()
      return true
    } catch (error) {
      showError(error?.message || '保存模型能力失败')
      return false
    } finally {
      capabilitySaveLoading.value = false
    }
  }

  const removeCapability = async (row) => {
    try {
      await deleteAiModelCapabilityApi(row.modelName)
      showSuccess('模型能力已删除')
      await loadCapabilities()
      await onChanged()
      return true
    } catch (error) {
      showError(error?.message || '删除模型能力失败')
      return false
    }
  }

  const findCapabilityByModelName = (modelName, providerKey = '') => {
    const normalized = normalizeModelNameForCapability(modelName, providerKey)
    return (
      capabilities.value.find((item) => normalizeCapabilityKey(item.modelName) === normalized) ||
      null
    )
  }

  return {
    capabilities,
    capabilityDialogVisible,
    capabilityLoading,
    capabilitySearchKeyword,
    capabilityFormVisible,
    capabilityEditing,
    capabilityFormRef,
    capabilitySaveLoading,
    capabilityForm,
    capabilityRules: CAPABILITY_RULES,
    filteredCapabilities,
    loadCapabilities,
    ensureCapabilitiesLoaded,
    openCapabilityManager,
    openCapabilityCreate,
    openCapabilityEdit,
    submitCapability,
    removeCapability,
    findCapabilityByModelName,
    capabilityIdentityLabel
  }
}
