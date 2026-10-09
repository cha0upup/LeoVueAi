<template>
  <ProxyListenerPanel
    v-model:bind-addr="controlForm.bindAddr"
    v-model:port="controlForm.port"
    class="http-proxy"
    :is-running="isRunning"
    :starting="starting"
    :stopping="stopping"
    :statistics="statistics"
    :checking="checking"
    :status="status"
    :error-message="errorMessage"
    @start="handleStart"
    @stop="handleStop"
    @refresh="fetchStatistics"
  />
</template>

<script setup>
import ProxyListenerPanel from './ProxyListenerPanel.vue'
import { useProxyListener } from '@/composables/useProxyListener.js'
import {
  getHttpProxyStatisticsApi,
  getHttpProxyStatusApi,
  startHttpProxyApi,
  stopHttpProxyApi
} from '@/services/api/agent-tools.js'

const props = defineProps({ sessionId: { type: String, required: true } })
const emit = defineEmits(['status-change', 'metrics-change'])
const {
  controlForm,
  isRunning,
  starting,
  stopping,
  checking,
  status,
  errorMessage,
  statistics,
  handleStart,
  handleStop,
  fetchStatistics
} = useProxyListener({
  sessionId: () => props.sessionId,
  emit,
  label: 'HTTP',
  defaultPort: 8080,
  statusField: 'running',
  api: {
    start: startHttpProxyApi,
    stop: stopHttpProxyApi,
    status: getHttpProxyStatusApi,
    statistics: getHttpProxyStatisticsApi
  }
})
</script>
