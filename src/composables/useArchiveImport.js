import { computed, ref } from 'vue'
import { executeRequest } from '@/utils/apiUtils.js'

const STATUS_TEXT = {
  imported: '已导入',
  overwritten: '已覆盖',
  renamed: '已重命名',
  skipped: '已跳过',
  failed: '失败'
}

export function useArchiveImport({ request, onImported }) {
  const uploadRef = ref(null)
  const selectedFile = ref(null)
  const conflictPolicy = ref('skip')
  const submitting = ref(false)
  const step = ref('pick')
  const results = ref([])
  let revision = 0

  const counts = computed(() => {
    const totals = Object.fromEntries(Object.keys(STATUS_TEXT).map((status) => [status, 0]))
    for (const { status } of results.value) {
      if (Object.hasOwn(totals, status)) totals[status] += 1
    }
    return totals
  })

  const statusText = (status) => Object.hasOwn(STATUS_TEXT, status) ? STATUS_TEXT[status] : status
  const resultClass = (status) => Object.hasOwn(STATUS_TEXT, status) ? `result-${status}` : ''

  const handleFileChange = (file) => {
    selectedFile.value = file.raw
  }
  const handleFileRemove = () => {
    selectedFile.value = null
  }

  const submit = async () => {
    if (!selectedFile.value || submitting.value) return
    const requestRevision = revision
    const formData = new FormData()
    formData.append('file', selectedFile.value)
    formData.append('conflictPolicy', conflictPolicy.value)
    await executeRequest(() => request(formData), {
      loadingRef: submitting,
      errorMessage: '导入失败',
      onSuccess: async (response) => {
        const importedResults = response.data?.results || []
        if (requestRevision === revision) {
          results.value = importedResults
          step.value = 'result'
        }
        await onImported(importedResults, formData)
      }
    }).catch(() => false) // executeRequest 已显示错误，保留文件以便重试。
  }

  const reset = () => {
    revision += 1
    selectedFile.value = null
    conflictPolicy.value = 'skip'
    step.value = 'pick'
    results.value = []
    uploadRef.value?.clearFiles()
  }

  return {
    uploadRef,
    selectedFile,
    conflictPolicy,
    submitting,
    step,
    results,
    counts,
    statusText,
    resultClass,
    handleFileChange,
    handleFileRemove,
    submit,
    reset
  }
}
