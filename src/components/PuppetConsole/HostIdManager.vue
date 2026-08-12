<template>
  <div class="hostid-manager">
    <div
      v-if="displayOnly"
      class="hostid-display-card"
    >
      <el-icon class="trigger-icon">
        <Icon :icon="iconMap.server" />
      </el-icon>
      <span class="trigger-text">
        <span class="label">{{ label }}</span>
        <span
          v-if="currentHostId"
          class="value"
        >{{ currentHostId }}</span>
        <span
          v-else
          class="empty-value"
        >未设置</span>
      </span>
    </div>

    <el-dropdown
      v-else
      trigger="click"
      placement="bottom-start"
      popper-class="hostid-dropdown"
      @visible-change="handleDropdownVisible"
    >
      <div class="hostid-trigger">
        <el-icon class="trigger-icon">
          <Icon :icon="iconMap.server" />
        </el-icon>
        <span class="trigger-text">
          <span class="label">{{ label }}</span>
          <span
            v-if="currentHostId"
            class="value"
          >{{ currentHostId }}</span>
          <span
            v-else
            class="empty-value"
          >未设置</span>
        </span>
        <el-icon class="trigger-arrow">
          <Icon :icon="iconMap.arrowDown" />
        </el-icon>
      </div>

      <template #dropdown>
        <el-dropdown-menu class="hostid-dropdown-menu">
          <div class="dropdown-header">
            <span class="header-title">HostId 管理</span>
            <el-button
              text
              type="primary"
              size="small"
              :loading="loading"
              class="refresh-btn"
              @click.stop="fetchAllHostIds"
            >
              <el-icon><Icon :icon="iconMap.refresh" /></el-icon>
              刷新
            </el-button>
          </div>

          <div class="dropdown-content">
            <div
              v-if="loading"
              class="loading-state"
            >
              <el-icon class="loading-icon">
                <Icon :icon="iconMap.loading" />
              </el-icon>
              <span>加载中...</span>
            </div>

            <div
              v-else-if="allHostIds.length > 0"
              class="hostid-list"
            >
              <div
                v-for="(hostId, index) in allHostIds"
                :key="index"
                class="hostid-item"
                :class="{ active: hostId === currentHostId }"
                @click="selectHostId(hostId)"
              >
                <el-icon class="item-icon">
                  <Icon :icon="iconMap.server" />
                </el-icon>
                <span class="item-text">{{ hostId }}</span>
                <el-icon
                  v-if="hostId === currentHostId"
                  class="check-icon"
                >
                  <Icon :icon="iconMap.check" />
                </el-icon>
              </div>
            </div>

            <div
              v-else-if="hasFetched"
              class="empty-state"
            >
              <el-icon class="empty-icon">
                <Icon :icon="iconMap.info" />
              </el-icon>
              <span class="empty-message">暂无 HostId</span>
            </div>

            <div
              v-else
              class="empty-state"
            >
              <span class="empty-message">点击刷新获取 HostId 列表</span>
            </div>
          </div>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'

import { Icon } from '@iconify/vue'
import { icons } from '@/utils/icons.js'
import { getCurrentHostIdApi, getAllHostIdsApi, setCurrentHostIdApi } from '@/services/api.js'
import { showError, showInfo, showSuccess, showWarning } from '@/utils/messageUtils.js'

const props = defineProps({
  sessionId: {
    type: String,
    required: true
  },
  displayOnly: {
    type: Boolean,
    default: false
  },
  label: {
    type: String,
    default: 'HostId'
  }
})

const emit = defineEmits(['hostid-changed'])

const iconMap = icons

// 响应式数据
const currentHostId = ref(null)
const allHostIds = ref([])
const loading = ref(false)
const hasFetched = ref(false)

// 获取当前 HostId
const fetchCurrentHostId = async () => {
  if (!props.sessionId) return

  try {
    const response = await getCurrentHostIdApi({ sessionId: props.sessionId })
    // 注意：http.js 拦截器已经将 response.data 设置为实际数据，所以这里直接访问
    currentHostId.value = response.data?.currentHostId || null
  } catch {
    // 静默处理错误，避免频繁提示
    currentHostId.value = null
  }
}

// 下拉菜单显示/隐藏处理
const handleDropdownVisible = (visible) => {
  if (visible && !hasFetched.value && !loading.value) {
    // 下拉菜单打开时自动获取列表
    fetchAllHostIds()
  }
}

// 获取所有 HostId
const fetchAllHostIds = async () => {
  if (!props.sessionId) {
    showWarning('会话ID不存在')
    return
  }

  loading.value = true
  hasFetched.value = false

  try {
    // 同时获取当前 HostId 和所有 HostId
    const [currentResponse, allResponse] = await Promise.all([
      getCurrentHostIdApi({ sessionId: props.sessionId }).catch(() => {
        return { data: { currentHostId: null } }
      }),
      getAllHostIdsApi({ sessionId: props.sessionId }).catch(() => {
        return { data: { allHostIds: [] } }
      })
    ])

    // http.js 拦截器已经将 response.data 设置为实际数据
    // 根据接口文档，currentResponse.data 应该是 { sessionId, currentHostId }
    // allResponse.data 应该是 { sessionId, allHostIds, count }
    currentHostId.value = currentResponse?.data?.currentHostId || null
    allHostIds.value = Array.isArray(allResponse?.data?.allHostIds)
      ? allResponse.data.allHostIds
      : []
    hasFetched.value = true

    if (allHostIds.value.length === 0 && !loading.value) {
      showInfo('当前会话暂无 HostId')
    }
  } catch {
    hasFetched.value = true
    allHostIds.value = []
    showError('获取 HostId 列表失败')
  } finally {
    loading.value = false
  }
}

// 选择并设置 HostId
const selectHostId = async (hostId) => {
  if (!props.sessionId) {
    showWarning('会话ID不存在')
    return
  }

  if (hostId === currentHostId.value) {
    showInfo('该 HostId 已经是当前使用的 HostId')
    return
  }

  try {
    const response = await setCurrentHostIdApi({
      sessionId: props.sessionId,
      hostId: hostId
    })

    // 注意：http.js 拦截器已经将 response.data 设置为实际数据
    currentHostId.value = response.data?.currentHostId || hostId
    showSuccess(`HostId 已设置为: ${hostId}`)

    // 触发 hostId 变更事件，通知父组件刷新
    emit('hostid-changed')
  } catch {
    showError('设置 HostId 失败')
  }
}

// 监听 sessionId 变化
watch(
  () => props.sessionId,
  (newSessionId) => {
    if (newSessionId) {
      fetchCurrentHostId()
      // 重置列表状态
      allHostIds.value = []
      hasFetched.value = false
    } else {
      currentHostId.value = null
      allHostIds.value = []
      hasFetched.value = false
    }
  }
)

// 生命周期
onMounted(() => {
  if (props.sessionId) {
    fetchCurrentHostId()
  }
})
</script>

<style scoped>
.hostid-manager {
  --hostid-muted-surface: color-mix(
    in srgb,
    var(--app-control-background-soft) 92%,
    var(--el-bg-color-overlay)
  );
  --hostid-panel-surface: color-mix(
    in srgb,
    var(--app-surface-background) 94%,
    var(--el-bg-color-overlay)
  );
  --hostid-soft-border: color-mix(in srgb, var(--el-border-color) 34%, transparent);
  display: flex;
  align-items: center;
  min-width: 0;
  width: 100%;
}

:global(html:not(.dark) .hostid-manager),
:global(html[data-theme='light'] .hostid-manager) {
  --hostid-muted-surface: #f2f2f2;
  --hostid-panel-surface: var(--app-surface-background);
  --hostid-soft-border: color-mix(in srgb, var(--el-border-color) 74%, transparent);
}

:global(html.dark .hostid-manager),
:global(html[data-theme='dark'] .hostid-manager) {
  --hostid-muted-surface: color-mix(
    in srgb,
    var(--app-control-background-soft) 76%,
    var(--el-bg-color-overlay)
  );
  --hostid-panel-surface: color-mix(
    in srgb,
    var(--app-surface-background) 86%,
    var(--el-bg-color-overlay)
  );
  --hostid-soft-border: color-mix(in srgb, var(--el-border-color) 28%, transparent);
}

.hostid-manager :deep(.el-dropdown) {
  display: block;
  width: 100%;
  min-width: 0;
}

.hostid-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  padding: 10px 12px;
  box-sizing: border-box;
  background: var(--hostid-muted-surface);
  border: 1px solid var(--hostid-soft-border);
  border-radius: var(--radius-control);
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  box-shadow: none;
}

.hostid-display-card {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  padding: 8px 10px;
  box-sizing: border-box;
  border-radius: var(--radius-control);
  background: var(--hostid-muted-surface);
  border: 1px solid var(--hostid-soft-border);
  box-shadow: none;
}

.hostid-trigger:hover {
  background: color-mix(in srgb, var(--el-color-primary) 6%, var(--hostid-muted-surface));
  border-color: color-mix(in srgb, var(--el-color-primary) 14%, var(--hostid-soft-border));
}

.trigger-icon {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-control);
  background: color-mix(in srgb, var(--el-color-primary) 12%, var(--app-control-background));
  font-size: 15px;
  color: var(--el-color-primary);
  flex-shrink: 0;
}

.trigger-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  min-width: 0;
  max-width: 100%;
  flex: 1;
  font-size: 13px;
  overflow: hidden;
}

.trigger-text .label {
  color: var(--el-text-color-secondary);
  font-weight: 600;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.trigger-text .value {
  font-family: 'Courier New', monospace;
  color: var(--el-text-color-primary);
  font-weight: 700;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trigger-text .empty-value {
  color: var(--el-text-color-placeholder);
  font-size: 12px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trigger-arrow {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  transition: color 0.2s ease;
  flex-shrink: 0;
}
</style>

<style>
/* 下拉菜单样式 */
.hostid-dropdown-menu {
  padding: 0;
  min-width: 320px;
  max-width: 400px;
  max-height: 500px;
  border-radius: var(--radius-overlay);
  overflow: hidden;
  border: 1px solid var(--hostid-soft-border);
  box-shadow: var(--shadow-overlay);
  background: var(--hostid-panel-surface);
}

.hostid-dropdown-menu .dropdown-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--hostid-soft-border);
  background: var(--hostid-panel-surface);
}

.hostid-dropdown-menu .header-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.hostid-dropdown-menu .refresh-btn {
  padding: 4px 8px;
  border-radius: 10px;
}

.hostid-dropdown-menu .dropdown-content {
  padding: 8px;
  max-height: 400px;
  overflow-y: auto;
}

.hostid-dropdown-menu .loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--el-spacing-small);
  padding: var(--el-spacing-large);
  color: var(--el-text-color-placeholder);
}

.hostid-dropdown-menu .loading-icon {
  font-size: 18px;
  animation: rotate 1s linear infinite;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.hostid-dropdown-menu .hostid-list {
  display: flex;
  flex-direction: column;
  gap: var(--el-spacing-xs);
}

.hostid-dropdown-menu .hostid-item {
  padding: 10px 12px;
  background: var(--hostid-muted-surface);
  border: 1px solid var(--hostid-soft-border);
  border-radius: var(--radius-control);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--el-spacing-small);
  transition: all 0.2s ease;
}

.hostid-dropdown-menu .hostid-item:hover {
  background: color-mix(in srgb, var(--el-color-primary) 6%, var(--hostid-muted-surface));
  border-color: color-mix(in srgb, var(--el-color-primary) 14%, var(--hostid-soft-border));
}

.hostid-dropdown-menu .hostid-item.active {
  background: color-mix(in srgb, var(--el-color-primary) 10%, var(--hostid-muted-surface));
  border-color: color-mix(in srgb, var(--el-color-primary) 18%, var(--hostid-soft-border));
  box-shadow: none;
}

.hostid-dropdown-menu .item-icon {
  font-size: 16px;
  color: var(--el-text-color-regular);
  flex-shrink: 0;
}

.hostid-dropdown-menu .hostid-item.active .item-icon {
  color: var(--el-color-primary);
}

.hostid-dropdown-menu .item-text {
  flex: 1;
  font-family: 'Courier New', monospace;
  font-size: 13px;
  color: var(--el-text-color-primary);
  word-break: break-all;
}

.hostid-dropdown-menu .check-icon {
  font-size: 18px;
  color: var(--el-color-primary);
  flex-shrink: 0;
}

.hostid-dropdown-menu .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--el-spacing-base);
  padding: var(--el-spacing-extra-large);
  color: var(--el-text-color-placeholder);
}

.hostid-dropdown-menu .empty-icon {
  font-size: 32px;
  opacity: 0.5;
}

.hostid-dropdown-menu .empty-message {
  font-size: 13px;
}

/* 滚动条样式 */
.hostid-dropdown-menu .dropdown-content::-webkit-scrollbar {
  width: 6px;
}

.hostid-dropdown-menu .dropdown-content::-webkit-scrollbar-track {
  background: transparent;
}

.hostid-dropdown-menu .dropdown-content::-webkit-scrollbar-thumb {
  background: var(--el-border-color);
  border-radius: 3px;
}

.hostid-dropdown-menu .dropdown-content::-webkit-scrollbar-thumb:hover {
  background: var(--el-text-color-placeholder);
}
</style>
