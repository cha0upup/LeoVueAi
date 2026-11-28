import { computed, shallowRef } from 'vue'

// 打开、刷新和编码切换共用一个请求生命周期。
export function useFilePreviewRequest() {
  const operation = shallowRef(null)

  const reset = () => {
    const previous = operation.value
    operation.value = null
    previous?.controller.abort()
  }

  const run = async (kind, action) => {
    const previous = operation.value
    const controller = new AbortController()
    const current = { kind, controller }
    const isCurrent = () => operation.value === current
    operation.value = current
    previous?.controller.abort()
    try {
      return await action({ isCurrent, signal: controller.signal })
    } finally {
      if (isCurrent()) operation.value = null
    }
  }

  return {
    run,
    reset,
    isPreviewLoading: computed(
      () => operation.value?.kind === 'preview' || operation.value?.kind === 'refresh'
    ),
    isRefreshing: computed(() => operation.value?.kind === 'refresh'),
    isEncoding: computed(() => operation.value?.kind === 'encoding')
  }
}
