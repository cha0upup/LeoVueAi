<template>
  <ProxyListenerPanel
    v-model:bind-addr="controlForm.bindAddr"
    v-model:port="controlForm.port"
    v-model:details-visible="detailsVisible"
    v-model:connection-page="connectionPage"
    class="socks5-proxy"
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
  getSocks5StatisticsApi,
  getSocks5StatusApi,
  startSocks5ProxyApi,
  stopSocks5ProxyApi
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
  detailsVisible,
  connectionPage,
  handleStart,
  handleStop,
  fetchStatistics
} = useProxyListener({
  sessionId: () => props.sessionId,
  emit,
  label: 'SOCKS5',
  defaultPort: 1080,
  statusField: 'enabled',
  api: {
    start: startSocks5ProxyApi,
    stop: stopSocks5ProxyApi,
    status: getSocks5StatusApi,
    statistics: getSocks5StatisticsApi
  }
})
</script>
