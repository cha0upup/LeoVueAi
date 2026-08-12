import { computed, onMounted, onUnmounted, ref } from 'vue'

/**
 * 响应式 dialog 宽度。
 *
 * 默认按视口分档（与 ClassBytecodeDialog 既有阶梯保持一致）：
 *   ≥2400  → 1800px
 *   ≥1920  → 1500px
 *   ≥1440  → 1200px
 *   ≥1024  →  920px
 *   <1024  →   92vw
 *
 * 调用方需要更窄/更宽时通过 options.breakpoints 覆盖；breakpoints 是按 minWidth 由大到小排序的数组。
 *
 * @param {object} [options]
 * @param {Array<{minWidth: number, width: string}>} [options.breakpoints]
 * @param {string} [options.fallback] 视口小于最小档位时使用的宽度，默认 '92vw'
 * @returns {{ dialogWidth: import('vue').ComputedRef<string>, viewportWidth: import('vue').Ref<number> }}
 */
export function useResponsiveDialogWidth(options = {}) {
  const breakpoints = options.breakpoints ?? [
    { minWidth: 2400, width: '1800px' },
    { minWidth: 1920, width: '1500px' },
    { minWidth: 1440, width: '1200px' },
    { minWidth: 1024, width: '920px' }
  ]
  const fallback = options.fallback ?? '92vw'

  const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1280)

  const onResize = () => {
    if (typeof window !== 'undefined') {
      viewportWidth.value = window.innerWidth
    }
  }

  onMounted(() => {
    window.addEventListener('resize', onResize)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', onResize)
  })

  const dialogWidth = computed(() => {
    const w = viewportWidth.value
    for (const bp of breakpoints) {
      if (w >= bp.minWidth) return bp.width
    }
    return fallback
  })

  return { dialogWidth, viewportWidth }
}
