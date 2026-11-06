import { computed, ref } from 'vue'

// 打开、刷新和编码切换共用一个请求生命周期。
export function useFilePreviewRequest() {
  const operation = ref(null)
  let generation = 0

  const reset = () => {
    generation += 1
    operation.value = null
  }

  const run = async (kind, action) => {
    const sequence = ++generation
    const isCurrent = () => sequence === generation
    operation.value = kind
    try {
      return await action(isCurrent)
    } finally {
      if (isCurrent()) operation.value = null
    }
  }

  return {
    run,
    reset,
    isPreviewLoading: computed(
      () => operation.value === 'preview' || operation.value === 'refresh'
    ),
    isRefreshing: computed(() => operation.value === 'refresh'),
    isEncoding: computed(() => operation.value === 'encoding')
  }
}
