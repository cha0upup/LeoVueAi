import { computed, inject, onMounted, onUnmounted, ref, shallowRef, unref, watch } from 'vue'
import {
  listLocalForwardsApi,
  startLocalForwardApi,
  stopLocalForwardApi,
  stopAllLocalForwardsApi,
  listReverseTunnelsApi,
  startReverseTunnelApi,
  stopReverseTunnelApi,
  stopAllReverseTunnelsApi
} from '@/services/api/agent-tools.js'
import { handleError } from '@/utils/errorHandler.js'
import { showSuccess, showWarning } from '@/utils/messageUtils.js'

const MODES = {
  forward: {
    label: '转发规则',
    port: 'localPort',
    minPort: 1024,
    host: 'targetHost',
    targetPort: 'targetPort',
    key: 'localPort',
    form: { bindAddr: '0.0.0.0', localPort: 8888, targetHost: '', targetPort: 80 },
    api: {
      list: listLocalForwardsApi,
      add: startLocalForwardApi,
      stop: stopLocalForwardApi,
      clear: stopAllLocalForwardsApi
    }
  },
  reverse: {
    label: '反向隧道',
    port: 'remoteListenPort',
    minPort: 1,
    host: 'forwardHost',
    targetPort: 'forwardPort',
    key: 'listenId',
    form: { bindAddr: '127.0.0.1', remoteListenPort: 8080, forwardHost: '', forwardPort: 4444 },
    api: {
      list: listReverseTunnelsApi,
      add: startReverseTunnelApi,
      stop: stopReverseTunnelApi,
      clear: stopAllReverseTunnelsApi
    }
  }
}
const ACTION_LABELS = { add: '添加', stop: '删除', clear: '全部清除' }

export function useProxyRules(mode, sessionId, emit) {
  const config = MODES[mode]
  const addForm = ref({ ...config.form })
  const rules = shallowRef([])
  const operation = ref(null)
  const refreshing = ref(false)
  const errorMessage = ref('')
  const busy = computed(() => operation.value !== null)
  let mounted = false
  let generation = 0
  let refreshPromise
  let timer
  const active = inject('proxyActive', true)
  const hasPendingCleanup = () => rules.value.some((rule) => rule.cleanupPending)
  const schedulePendingRefresh = () => {
    clearTimeout(timer)
    if (!mounted || !hasPendingCleanup()) return
    timer = setTimeout(() => {
      if (
        unref(active) &&
        (typeof document === 'undefined' || document.visibilityState !== 'hidden')
      )
        fetchRules()
      else schedulePendingRefresh()
    }, 3000)
  }
  const current = (request) => mounted && generation === request
  const publish = () => {
    emit('rules-change', rules.value.length)
    emit(
      'status-change',
      rules.value.some((rule) => rule.running)
        ? 'running'
        : hasPendingCleanup()
          ? 'error'
          : 'stopped'
    )
  }
  const reportError = (error, notify = false) => {
    errorMessage.value = handleError(error, {
      defaultMessage: `${config.label}操作失败`,
      showMessage: notify
    })
    emit('status-change', 'error')
  }
  const invalidate = () => {
    clearTimeout(timer)
    refreshing.value = false
    refreshPromise = null
    return ++generation
  }
  const fetchRules = (internal = false) => {
    if (!mounted || (busy.value && internal !== true)) return
    if (refreshPromise) return refreshPromise
    clearTimeout(timer)
    const request = generation
    const currentSession = sessionId()
    refreshing.value = true
    refreshPromise = Promise.resolve().then(async () => {
      if (!current(request)) return
      try {
        const response = await config.api.list({ sessionId: currentSession })
        if (!current(request)) return
        const list = response.data ?? []
        if (!Array.isArray(list)) throw new Error(`${config.label}列表响应格式异常`)
        rules.value = list
        errorMessage.value = ''
        publish()
      } catch (error) {
        if (current(request)) reportError(error)
      } finally {
        if (current(request)) {
          refreshing.value = false
          refreshPromise = null
          schedulePendingRefresh()
        }
      }
    })
    return refreshPromise
  }
  const mutate = async (kind, params = {}) => {
    if (!mounted || busy.value) return
    const request = invalidate()
    operation.value = { kind, key: params[config.key] }
    try {
      const response = await config.api[kind]({ sessionId: sessionId(), ...params })
      if (!current(request)) return
      errorMessage.value = ''
      const pending = response.data?.cleanupPending || response.data?.pendingCount > 0
      if (kind === 'add' || pending) {
        await fetchRules(true)
      } else {
        rules.value =
          kind === 'clear'
            ? []
            : rules.value.filter((rule) => rule[config.key] !== params[config.key])
        publish()
      }
      if (current(request)) {
        if (pending) {
          errorMessage.value = response.data?.msg ?? '本地已停止，远端清理待确认'
          showWarning(errorMessage.value)
        } else showSuccess(`${config.label}已${ACTION_LABELS[kind]}`)
      }
    } catch (error) {
      if (current(request)) reportError(error, true)
    } finally {
      if (current(request)) {
        operation.value = null
        schedulePendingRefresh()
      }
    }
  }
  const handleAdd = () => {
    const form = addForm.value
    const bindAddr = form.bindAddr.trim() || (mode === 'reverse' ? '127.0.0.1' : '')
    if (!bindAddr) return showWarning('请选择或输入监听地址')
    const port = form[config.port],
      targetPort = form[config.targetPort],
      host = form[config.host].trim()
    if (!Number.isInteger(port) || port < config.minPort || port > 65535) {
      return showWarning(
        `请输入有效的${mode === 'reverse' ? 'agent 监听' : '本地'}端口（${config.minPort}-65535）`
      )
    }
    if (!host) return showWarning('请输入目标主机地址')
    if (!Number.isInteger(targetPort) || targetPort < 1 || targetPort > 65535) {
      return showWarning('请输入有效的目标端口号（1-65535）')
    }
    return mutate('add', { ...form, bindAddr, [config.host]: host })
  }
  watch(
    sessionId,
    () => {
      invalidate()
      operation.value = null
      rules.value = []
      addForm.value = { ...config.form }
      errorMessage.value = ''
      if (mounted) {
        emit('rules-change', 0)
        emit('status-change', 'unknown')
        fetchRules()
      }
    },
    { flush: 'sync' }
  )
  onMounted(() => {
    mounted = true
    fetchRules()
  })
  onUnmounted(() => {
    mounted = false
    invalidate()
  })
  return {
    rules,
    addForm,
    busy,
    refreshing,
    errorMessage,
    fetchRules,
    handleAdd,
    adding: computed(() => operation.value?.kind === 'add'),
    stoppingAll: computed(() => operation.value?.kind === 'clear'),
    stoppingKey: computed(() => (operation.value?.kind === 'stop' ? operation.value.key : null)),
    handleStop: (key) => mutate('stop', { [config.key]: key }),
    handleStopAll: () => mutate('clear')
  }
}
