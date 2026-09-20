<template>
  <ProxyListenerPanel
    v-model:bind-addr="controlForm.bindAddr"
    v-model:port="controlForm.port"
    class="socks5-proxy"
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
  getSocks5StatisticsApi,
  getSocks5StatusApi,
  startSocks5ProxyApi,
  stopSocks5ProxyApi
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
  port: 1080
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
        startSocks5ProxyApi({
          sessionId: props.sessionId,
          port: controlForm.value.port,
          bindAddr
        }),
      {
        loadingRef: starting,
        successMessage: 'SOCKS5 代理已启动',
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
        stopSocks5ProxyApi({
          sessionId: props.sessionId
        }),
      {
        loadingRef: stopping,
        successMessage: 'SOCKS5 代理已停止',
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
        const res = await getSocks5StatisticsApi({
          sessionId: props.sessionId
        })
        statistics.value = res.data
        return res
      },
      {
        successMessage: null,
        errorMessage: '获取统计信息失败'
      }
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
  refreshTimer.value = setInterval(() => {
    fetchStatistics()
  }, 3000)
}

const stopAutoRefresh = () => {
  if (refreshTimer.value) {
    clearInterval(refreshTimer.value)
    refreshTimer.value = null
  }
}

const checkProxyStatus = async () => {
  try {
    const res = await getSocks5StatusApi({
      sessionId: props.sessionId
    })
    if (res.data?.enabled) {
      isRunning.value = true
      if (res.data.bindAddr) controlForm.value.bindAddr = res.data.bindAddr
      if (res.data.port) {
        controlForm.value.port = res.data.port
      }
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
