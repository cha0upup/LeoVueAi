import { computed, inject, onMounted, onUnmounted, ref, shallowRef, unref, watch } from 'vue'
import { handleError } from '@/utils/errorHandler.js'
import { showSuccess, showWarning } from '@/utils/messageUtils.js'

export function useProxyListener({ sessionId, emit, label, defaultPort, statusField, api }) {
  const controlForm = ref({ bindAddr: '0.0.0.0', port: defaultPort })
  const isRunning = ref(false)
  const starting = ref(false)
  const stopping = ref(false)
  const checking = ref(false)
  const status = ref('unknown')
  const errorMessage = ref('')
  const statistics = shallowRef(null)
  const detailsVisible = ref(true)
  const connectionPage = ref(1)
  const pageSize = 50
  let lastDetailsCheck = 0
  const active = inject('proxyActive', true)
  const pageVisible = ref(typeof document === 'undefined' || document.visibilityState !== 'hidden')
  const visible = computed(() => unref(active) && pageVisible.value)
  const updateVisibility = () => {
    pageVisible.value = document.visibilityState !== 'hidden'
  }
  let mounted = false
  let generation = 0
  let timer
  let refreshPromise
  let lastStatusCheck = 0

  const isCurrent = (request) => mounted && request === generation
  const publish = (nextStatus) => {
    status.value = nextStatus
    emit('status-change', nextStatus)
    emit('metrics-change', {
      status: nextStatus,
      activeConnections: statistics.value?.activeConnections ?? 0,
      totalConnections: statistics.value?.totalConnections ?? 0,
      port: statistics.value?.port ?? controlForm.value.port ?? null
    })
  }
  const invalidate = () => {
    clearTimeout(timer)
    refreshPromise = null
    checking.value = false
    return ++generation
  }
  const reportError = (error, fallback, notify = false) => {
    errorMessage.value = handleError(error, { defaultMessage: fallback, showMessage: notify })
    publish('error')
  }
  const scheduleRefresh = (request) => {
    clearTimeout(timer)
    if (isCurrent(request) && visible.value && (isRunning.value || status.value === 'error')) {
      timer = setTimeout(() => refresh(false), 3000)
    }
  }

  // 每轮完成后再计时；手动刷新复用当前请求，避免慢请求重叠。
  const refresh = (verifyStatus = true) => {
    if (!mounted || !visible.value || starting.value || stopping.value) return
    if (refreshPromise) return refreshPromise
    clearTimeout(timer)
    const request = generation
    const currentSession = sessionId()
    checking.value = true
    const load = async () => {
      if (!isCurrent(request)) return
      try {
        if (!visible.value) return
        if (verifyStatus || status.value !== 'running' || Date.now() - lastStatusCheck >= 30_000) {
          const response = await api.status({ sessionId: currentSession })
          if (!isCurrent(request)) return
          const data = response.data
          if (typeof data?.[statusField] !== 'boolean') {
            throw new Error('代理状态响应格式异常')
          }
          isRunning.value = data[statusField]
          controlForm.value.bindAddr = data.bindAddr ?? controlForm.value.bindAddr
          controlForm.value.port = data.port ?? controlForm.value.port
          lastStatusCheck = Date.now()
        }
        if (isRunning.value) {
          const includeConnections =
            detailsVisible.value &&
            (verifyStatus || !statistics.value || Date.now() - lastDetailsCheck >= 10_000)
          const response = await api.statistics({
            sessionId: currentSession,
            includeConnections,
            page: connectionPage.value,
            pageSize
          })
          if (!isCurrent(request)) return
          const data = response.data
          const lastPage = Math.max(
            1,
            Math.ceil((data.connectionCount ?? data.activeConnections ?? 0) / pageSize)
          )
          if (connectionPage.value > lastPage) {
            connectionPage.value = lastPage
            return
          }
          statistics.value = {
            ...data,
            connections:
              data.connectionCount === 0
                ? []
                : (data.connections ?? statistics.value?.connections ?? [])
          }
          if (includeConnections) lastDetailsCheck = Date.now()
        } else {
          statistics.value = null
        }
        errorMessage.value = ''
        publish(isRunning.value ? 'running' : 'stopped')
      } catch (error) {
        if (isCurrent(request)) reportError(error, '获取代理状态或统计信息失败')
      } finally {
        if (isCurrent(request)) {
          checking.value = false
          refreshPromise = null
          scheduleRefresh(request)
        }
      }
    }
    refreshPromise = Promise.resolve().then(load)
    return refreshPromise
  }
  const fetchStatistics = () => refresh()

  const changeListener = async (start) => {
    if (!mounted || starting.value || stopping.value) return
    const bindAddr = controlForm.value.bindAddr.trim()
    const port = controlForm.value.port
    if (start) {
      if (!bindAddr) return showWarning('请选择或输入监听地址')
      if (!Number.isInteger(port) || port < 1024 || port > 65535) {
        return showWarning('请输入有效的端口号（1024-65535）')
      }
    }
    const request = invalidate()
    const busy = start ? starting : stopping
    busy.value = true
    try {
      const response = await (start ? api.start : api.stop)({
        sessionId: sessionId(),
        ...(start ? { bindAddr, port } : {})
      })
      if (!isCurrent(request)) return
      isRunning.value = start
      statistics.value = null
      connectionPage.value = 1
      lastDetailsCheck = 0
      errorMessage.value = ''
      if (start) {
        controlForm.value.bindAddr = response.data?.bindAddr ?? bindAddr
        controlForm.value.port = response.data?.port ?? port
      }
      publish(start ? 'running' : 'stopped')
      showSuccess(`${label} 代理已${start ? '启动' : '停止'}`)
    } catch (error) {
      if (isCurrent(request)) reportError(error, start ? '代理启动失败' : '停止代理失败', true)
    } finally {
      if (isCurrent(request)) {
        busy.value = false
        if (isRunning.value && status.value !== 'error') {
          await fetchStatistics()
        } else {
          scheduleRefresh(request)
        }
      }
    }
  }

  watch(
    sessionId,
    () => {
      invalidate()
      starting.value = stopping.value = isRunning.value = false
      statistics.value = null
      connectionPage.value = 1
      lastDetailsCheck = lastStatusCheck = 0
      errorMessage.value = ''
      controlForm.value = { bindAddr: '0.0.0.0', port: defaultPort }
      if (mounted) {
        publish('unknown')
        fetchStatistics()
      }
    },
    { flush: 'sync' }
  )
  watch(
    [detailsVisible, connectionPage],
    () => {
      lastDetailsCheck = 0
      if (starting.value || stopping.value) return
      invalidate()
      refresh(false)
    },
    { flush: 'sync' }
  )
  onMounted(() => {
    mounted = true
    if (typeof document !== 'undefined')
      document.addEventListener('visibilitychange', updateVisibility)
    publish('unknown')
    fetchStatistics()
  })
  onUnmounted(() => {
    mounted = false
    invalidate()
    if (typeof document !== 'undefined')
      document.removeEventListener('visibilitychange', updateVisibility)
  })
  watch(
    visible,
    (value) => {
      clearTimeout(timer)
      if (value) fetchStatistics()
    },
    { flush: 'sync' }
  )

  return {
    controlForm,
    isRunning,
    starting,
    stopping,
    checking,
    status,
    errorMessage,
    statistics,
    detailsVisible,
    connectionPage,
    handleStart: () => changeListener(true),
    handleStop: () => changeListener(false),
    fetchStatistics
  }
}
