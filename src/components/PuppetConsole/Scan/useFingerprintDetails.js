import { ref, watch, onScopeDispose } from 'vue'
import {
  queryNetworkFingerprintMatchesApi,
  queryNetworkFingerprintEvidenceApi
} from '@/services/api.js'

export function useFingerprintDetails(props) {
  const matches = ref([])
  const page = ref(1)
  const total = ref(0)
  const loading = ref(false)
  const error = ref('')
  const evidence = ref(null)
  const evidenceLoading = ref(false)
  const evidenceError = ref('')
  let listSequence = 0
  let evidenceSequence = 0
  let disposed = false

  async function load() {
    const sequence = ++listSequence
    loading.value = true
    error.value = ''
    try {
      const response = await queryNetworkFingerprintMatchesApi({
        sessionId: props.sessionId,
        taskId: props.taskId,
        endpointId: props.endpointId,
        page: page.value,
        pageSize: 20
      })
      if (disposed || sequence !== listSequence) return
      matches.value = response.data?.matches || []
      total.value = Number(response.data?.total || 0)
    } catch (cause) {
      if (!disposed && sequence === listSequence) error.value = cause?.message || '读取识别明细失败'
    } finally {
      if (!disposed && sequence === listSequence) loading.value = false
    }
  }

  async function showEvidence(match) {
    const sequence = ++evidenceSequence
    evidence.value = null
    evidenceError.value = ''
    evidenceLoading.value = true
    try {
      const response = await queryNetworkFingerprintEvidenceApi({
        sessionId: props.sessionId,
        taskId: props.taskId,
        matchKey: match.matchKey
      })
      if (!disposed && sequence === evidenceSequence) evidence.value = response.data
    } catch (cause) {
      if (!disposed && sequence === evidenceSequence)
        evidenceError.value = cause?.message || '读取响应证据失败'
    } finally {
      if (!disposed && sequence === evidenceSequence) evidenceLoading.value = false
    }
  }

  watch(
    () => [props.sessionId, props.taskId, props.endpointId],
    () => {
      listSequence += 1
      evidenceSequence += 1
      matches.value = []
      total.value = 0
      page.value = 1
      evidence.value = null
      evidenceError.value = ''
      evidenceLoading.value = false
      load()
    },
    { immediate: true, flush: 'sync' }
  )
  watch(
    () => props.refreshToken,
    () => {
      if (!loading.value) load()
    }
  )
  onScopeDispose(() => {
    disposed = true
    listSequence += 1
    evidenceSequence += 1
  })
  return {
    matches,
    page,
    total,
    loading,
    error,
    evidence,
    evidenceLoading,
    evidenceError,
    load,
    showEvidence
  }
}
