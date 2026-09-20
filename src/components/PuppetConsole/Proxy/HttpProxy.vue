<template>
  <ProxyListenerPanel
    v-model:bind-addr="controlForm.bindAddr"
    v-model:port="controlForm.port"
    class="http-proxy"
    :is-running="isRunning"
    :starting="starting"
    :stopping="stopping"
    :statistics="statistics"
    @start="handleStart"
    @stop="handleStop"
    @refresh="fetchStatistics"
  />
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import ProxyListenerPanel from './ProxyListenerPanel.vue'
import {
  getHttpProxyStatisticsApi,
  getHttpProxyStatusApi,
  startHttpProxyApi,
  stopHttpProxyApi
} from '@/services/api.js'
import { executeRequest } from '@/utils/apiUtils.js'
import { showWarning } from '@/utils/messageUtils.js'

const props = defineProps({
  sessionId: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['status-change', 'metrics-change'])

const starting = ref(false)
const stopping = ref(false)
const isRunning = ref(false)
const statistics = ref(null)
const refreshTimer = ref(null)

const controlForm = ref({
  bindAddr: '0.0.0.0',
  port: 8080
})

const emitMetrics = () => {
  emit('metrics-change', {
    status: isRunning.value ? 'running' : 'stopped',
    activeConnections: statistics.value?.activeConnections ?? 0,
    totalConnections: statistics.value?.totalConnections ?? 0,
    port: statistics.value?.port ?? controlForm.value.port ?? null
  })
}

const handleStart = async () => {
  const bindAddr = controlForm.value.bindAddr.trim()
  if (!bindAddr) {
    showWarning('请选择或输入监听地址')
    return
  }
  if (!controlForm.value.port || controlForm.value.port < 1024 || controlForm.value.port > 65535) {
    showWarning('请输入有效的端口号（1024-65535）')
    return
  }
  starting.value = true
  try {
    const response = await executeRequest(
      async () =>
        startHttpProxyApi({
          sessionId: props.sessionId,
          port: controlForm.value.port,
          bindAddr
        }),
      {
        loadingRef: starting,
        successMessage: 'HTTP 代理已启动',
        errorMessage: '代理启动失败'
      }
    )
    controlForm.value.bindAddr = response.data?.bindAddr ?? bindAddr
    controlForm.value.port = response.data?.port ?? controlForm.value.port
    isRunning.value = true
    emit('status-change', 'running')
    await fetchStatistics()
    startAutoRefresh()
  } catch {
    emit('status-change', 'error')
  } finally {
    starting.value = false
    emitMetrics()
  }
}

const handleStop = async () => {
  stopping.value = true
  try {
    await executeRequest(
      async () =>
        stopHttpProxyApi({
          sessionId: props.sessionId
        }),
      {
        loadingRef: stopping,
        successMessage: 'HTTP 代理已停止',
        errorMessage: '停止代理失败'
      }
    )
    isRunning.value = false
    statistics.value = null
    emit('status-change', 'stopped')
    stopAutoRefresh()
  } catch {
    emit('status-change', 'error')
  } finally {
    stopping.value = false
    emitMetrics()
  }
}

const fetchStatistics = async () => {
  if (!isRunning.value) {
    emitMetrics()
    return
  }
  try {
    await executeRequest(
      async () => {
        const res = await getHttpProxyStatisticsApi({ sessionId: props.sessionId })
        statistics.value = res.data
        return res
      },
      { successMessage: null, errorMessage: '获取统计信息失败' }
    )
    emitMetrics()
  } catch (error) {
    if (error.message && error.message.includes('未启动')) {
      isRunning.value = false
      statistics.value = null
      emit('status-change', 'stopped')
      stopAutoRefresh()
      emitMetrics()
    }
  }
}

const startAutoRefresh = () => {
  stopAutoRefresh()
  refreshTimer.value = setInterval(fetchStatistics, 3000)
}

const stopAutoRefresh = () => {
  if (refreshTimer.value) {
    clearInterval(refreshTimer.value)
    refreshTimer.value = null
  }
}

const checkProxyStatus = async () => {
  try {
    const res = await getHttpProxyStatusApi({ sessionId: props.sessionId })
    if (res.data?.running) {
      isRunning.value = true
      if (res.data.bindAddr) controlForm.value.bindAddr = res.data.bindAddr
      if (res.data.port) controlForm.value.port = res.data.port
      emit('status-change', 'running')
      await fetchStatistics()
      startAutoRefresh()
    } else {
      isRunning.value = false
      statistics.value = null
      emit('status-change', 'stopped')
      emitMetrics()
    }
  } catch {
    isRunning.value = false
    statistics.value = null
    emit('status-change', 'stopped')
    emitMetrics()
  }
}

onMounted(async () => {
  await checkProxyStatus()
})

onUnmounted(() => {
  stopAutoRefresh()
})
</script>
