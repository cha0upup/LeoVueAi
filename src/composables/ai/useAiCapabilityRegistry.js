import { computed, getCurrentScope, onScopeDispose, reactive, ref } from 'vue'

import {
  createAiModelCapabilityApi,
  deleteAiModelCapabilityApi,
  listAiModelCapabilitiesApi,
  updateAiModelCapabilityApi
} from '@/services/api/admin.js'
import { handleError } from '@/utils/errorHandler.js'
import { createLatestRequestGuard } from '@/utils/latestRequestGuard.js'
import { showError, showSuccess } from '@/utils/messageUtils.js'
import {
  buildCapabilityBody,
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
  const capabilityLoadError = ref('')
  const capabilitySearchKeyword = ref('')
  const capabilityFormVisible = ref(false)
  const capabilityEditing = ref(null)
  const capabilityFormRef = ref(null)
  const capabilitySaveLoading = ref(false)
  const capabilityForm = reactive(createCapabilityForm())
  const reads = createLatestRequestGuard(['capabilities'])
  let hasLoadedCapabilities = false
  let disposed = false

  if (getCurrentScope()) onScopeDispose(() => {
    disposed = true
    reads.invalidate()
  })

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

  function readCapabilities() {
    if (disposed) return
    return reads.coalesce('capabilities', async (isCurrent) => {
      capabilityLoading.value = true
      try {
        const { data } = await listAiModelCapabilitiesApi()
        if (!isCurrent()) return
        if (!Array.isArray(data)) throw new Error('能力库响应格式异常')
        capabilities.value = data
        hasLoadedCapabilities = true
        capabilityLoadError.value = ''
      } catch (error) {
        if (isCurrent()) {
          capabilityLoadError.value = handleError(error, {
            defaultMessage: '加载能力库失败',
            showMessage: !capabilityDialogVisible.value
          })
        }
      } finally {
        if (isCurrent()) capabilityLoading.value = false
      }
    })
  }

  function loadCapabilities() {
    reads.invalidate()
    return readCapabilities()
  }

  const ensureCapabilitiesLoaded = async () => {
    if (!hasLoadedCapabilities) await readCapabilities()
    return capabilities.value
  }

  const openCapabilityManager = async () => {
    capabilityDialogVisible.value = true
    await ensureCapabilitiesLoaded()
  }

  const openCapabilityCreate = () => {
    capabilityEditing.value = null
    resetReactiveForm(capabilityForm, createCapabilityForm())
    capabilityFormVisible.value = true
  }

  const openCapabilityEdit = (row) => {
    capabilityEditing.value = row
    resetReactiveForm(capabilityForm, capabilityToForm(row))
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
    capabilityDialogVisible,
    capabilityLoading,
    capabilityLoadError,
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
    findCapabilityByModelName
  }
}
