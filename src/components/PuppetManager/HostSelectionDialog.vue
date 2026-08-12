<template>
  <el-dialog
    v-model="visible"
    width="min(680px, calc(100vw - 32px))"
    class="host-selection-dialog"
    :close-on-click-modal="false"
    :close-on-press-escape="stage === 'selecting'"
    destroy-on-close
    @closed="handleClosed"
  >
    <template #header>
      <div class="host-selection-title">
        <span class="host-selection-title__icon">
          <el-icon><Icon :icon="iconMap.server" /></el-icon>
        </span>
        <span>
          <strong>{{ stage === 'selecting' ? '选择目标后端主机' : '准备连接' }}</strong>
          <small>{{ context?.puppetName || '当前主机' }}</small>
        </span>
      </div>
    </template>

    <div
      v-if="stage === 'discovering'"
      class="host-selection-state"
    >
      <el-icon class="host-selection-spinner">
        <Icon :icon="iconMap.loading" />
      </el-icon>
      <strong>正在识别后端主机...</strong>
      <span v-if="currentHostId">当前随机命中：{{ currentHostId }}</span>
      <span>正在获取可用后端实例，请稍候</span>
    </div>

    <template v-else-if="stage === 'selecting'">
      <p class="host-selection-hint">
        已发现 {{ hosts.length }} 台可用后端主机，请选择要进入的实例。
        <span v-if="discoveredAt">上次识别：{{ discoveredAt }}</span>
      </p>
      <el-radio-group
        v-model="selectedHostId"
        class="host-selection-list"
      >
        <label
          v-for="(hostId, index) in hosts"
          :key="hostId"
          class="host-selection-item"
          :class="{ active: selectedHostId === hostId }"
        >
          <el-radio
            :value="hostId"
            class="host-selection-radio"
          />
          <span class="host-selection-item__body">
            <strong>{{ instanceLabel(index) }}</strong>
            <code :title="hostId">HostId: {{ hostId }}</code>
            <small>{{ hostStatus(hostId) }}</small>
          </span>
          <el-icon
            v-if="hostId === currentHostId"
            class="host-selection-current"
          >
            <Icon :icon="iconMap.check" />
          </el-icon>
        </label>
      </el-radio-group>
    </template>

    <div
      v-else
      class="host-selection-state is-error"
    >
      <el-icon><Icon :icon="iconMap.warning" /></el-icon>
      <strong>暂未发现可用后端主机</strong>
      <span>{{ errorMessage || '请检查连接状态后重试' }}</span>
    </div>

    <template #footer>
      <div class="host-selection-footer">
        <el-button
          @click="cancel"
        >
          取消
        </el-button>
        <el-button
          v-if="stage === 'error'"
          type="primary"
          :loading="loading"
          @click="refresh"
        >
          <el-icon><Icon :icon="iconMap.refresh" /></el-icon>
          重新识别
        </el-button>
        <template v-else-if="stage === 'selecting'">
          <el-button
            v-if="context?.mode !== 'cache'"
            :disabled="loading"
            :loading="loading"
            @click="refresh"
          >
            <el-icon><Icon :icon="iconMap.refresh" /></el-icon>
            刷新实例
          </el-button>
          <el-button
            :disabled="!currentHostId || selectedHostId === currentHostId"
            @click="bindCurrent"
          >
            进入当前命中主机
          </el-button>
          <el-button
            type="primary"
            :disabled="!selectedHostId"
            :loading="loading"
            @click="bindSelected"
          >
            进入{{ selectedLabel }}
          </el-button>
        </template>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'

import { discoverPuppetHostsApi, getPuppetCacheHostsApi } from '@/services/api.js'
import { icons } from '@/utils/icons.js'

const emit = defineEmits(['cancel'])
const iconMap = icons
const visible = ref(false)
const stage = ref('discovering')
const loading = ref(false)
const errorMessage = ref('')
const discoveredAt = ref('')
const context = ref(null)
const hosts = ref([])
const currentHostId = ref('')
const selectedHostId = ref('')
let resolveOpen = null

const instanceLabel = (index) => `后端实例 ${String.fromCharCode(65 + (index % 26))}`
const selectedLabel = computed(() => {
  const index = hosts.value.indexOf(selectedHostId.value)
  return index >= 0 ? instanceLabel(index) : '目标后端'
})
const hostStatus = (hostId) => {
  if (context.value?.mode === 'cache') return '缓存状态：已有缓存'
  if (!currentHostId.value) return '登记状态：已登记'
  return hostId === currentHostId.value ? '本次发现 · 默认选择' : '本次发现'
}

const reset = () => {
  stage.value = 'discovering'
  loading.value = false
  errorMessage.value = ''
  discoveredAt.value = ''
  context.value = null
  hosts.value = []
  currentHostId.value = ''
  selectedHostId.value = ''
}

const closeWith = (result) => {
  const resolver = resolveOpen
  resolveOpen = null
  visible.value = false
  resolver?.(result)
}

const cancel = () => {
  emit('cancel')
  closeWith(null)
}

const handleClosed = () => {
  if (resolveOpen) closeWith(null)
  reset()
}

const choose = (hostId) => {
  if (!hostId || !context.value) return
  closeWith({ ...context.value, selectedHostId: hostId })
}

const bindCurrent = () => choose(currentHostId.value)
const bindSelected = () => choose(selectedHostId.value)

const discover = async () => {
  if (!context.value?.puppetId || loading.value) return
  stage.value = 'discovering'
  loading.value = true
  errorMessage.value = ''
  discoveredAt.value = ''
  try {
    const force = Boolean(context.value.forceRefresh)
    context.value.forceRefresh = false
    const response = context.value.mode === 'cache'
      ? await getPuppetCacheHostsApi(context.value.puppetId, context.value.projectId)
      : await discoverPuppetHostsApi(context.value.puppetId, context.value.projectId, force)
    const discovered = Array.isArray(response?.data?.hosts)
      ? response.data.hosts.filter(Boolean)
      : []
    hosts.value = [...new Set(discovered)]
    discoveredAt.value = response?.data?.discoveredAt || ''
    currentHostId.value = context.value.mode === 'cache' || response?.data?.cached
      ? '' : (hosts.value[0] || '')
    // 单实例也保留在选择页，但默认勾选第一项，用户仍需明确确认进入。
    selectedHostId.value = hosts.value[0] || ''
    if (!hosts.value.length) throw new Error('当前暂无可用后端主机')
    stage.value = 'selecting'
  } catch (error) {
    stage.value = 'error'
    errorMessage.value = error?.response?.data?.msg || error?.message || '后端主机识别失败'
  } finally {
    loading.value = false
  }
}

const refresh = () => {
  if (!context.value) return
  context.value.forceRefresh = context.value.mode !== 'cache'
  discover()
}

const open = (entry) => {
  reset()
  context.value = { ...entry }
  visible.value = true
  const promise = new Promise((resolve) => { resolveOpen = resolve })
  discover()
  return promise
}

defineExpose({ open })
</script>

<style scoped>
.host-selection-title,
.host-selection-title > span:last-child,
.host-selection-item,
.host-selection-item__body,
.host-selection-footer {
  display: flex;
}
.host-selection-title { align-items: center; gap: 10px; }
.host-selection-title__icon {
  width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center;
  border-radius: 9px; color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 11%, transparent);
}
.host-selection-title > span:last-child, .host-selection-item__body { flex-direction: column; min-width: 0; }
.host-selection-title strong { font-size: 15px; }
.host-selection-title small, .host-selection-hint, .host-selection-item small { color: var(--el-text-color-placeholder); font-size: 11px; }
.host-selection-state { min-height: 170px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: var(--el-text-color-secondary); text-align: center; }
.host-selection-state strong { color: var(--el-text-color-primary); font-size: 15px; }
.host-selection-state.is-error > .el-icon { color: var(--el-color-warning); font-size: 26px; }
.host-selection-spinner { color: var(--el-color-primary); font-size: 26px; animation: host-selection-spin 1s linear infinite; }
.host-selection-hint { margin: 0 0 14px; line-height: 1.6; }
.host-selection-list { display: flex; flex-direction: column; align-items: stretch; gap: 10px; width: 100%; }
.host-selection-item { width: 100%; min-height: 78px; align-items: center; gap: 12px; padding: 14px 16px; border: 1px solid var(--app-divider-color); border-radius: 8px; cursor: pointer; }
.host-selection-item.active { border-color: var(--el-color-primary); background: color-mix(in srgb, var(--el-color-primary) 6%, transparent); }
.host-selection-radio { flex: 0 0 auto; }
.host-selection-item__body { flex: 1; gap: 4px; }
.host-selection-item__body strong { color: var(--el-text-color-primary); font-size: 13px; }
.host-selection-item__body code { max-width: 100%; overflow: hidden; color: var(--el-text-color-regular); font-family: var(--font-family-code); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.host-selection-current { flex: 0 0 auto; color: var(--el-color-success); }
.host-selection-footer { align-items: center; justify-content: flex-end; gap: 8px; }
@media (max-width: 620px) {
  .host-selection-item { min-height: 72px; padding: 12px; }
  .host-selection-footer { flex-wrap: wrap; }
}
@keyframes host-selection-spin { to { transform: rotate(360deg); } }
</style>
