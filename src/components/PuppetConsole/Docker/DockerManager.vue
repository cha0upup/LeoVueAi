<template>
  <div class="docker-workbench">
    <div
      class="docker-shell"
      :class="{ 'has-terminal': terminalActive }"
    >
      <!-- 工具栏 -->
      <section class="docker-toolbar">
        <div class="toolbar-left">
          <el-radio-group
            v-model="activeTab"
            size="small"
            @change="handleTabChange"
          >
            <el-radio-button value="containers">
              容器
            </el-radio-button>
            <el-radio-button value="images">
              镜像
            </el-radio-button>
            <el-radio-button value="networks">
              网络
            </el-radio-button>
          </el-radio-group>
          <el-button
            type="primary"
            size="small"
            :loading="isLoading"
            @click="handleRefresh"
          >
            <el-icon><Icon icon="mdi:refresh" /></el-icon>
            刷新
          </el-button>
          <el-checkbox
            v-if="activeTab === 'containers'"
            v-model="showAll"
            size="small"
            @change="handleShowAllChange"
          >
            包含已停止
          </el-checkbox>
        </div>
        <div class="toolbar-right">
          <span
            v-if="currentList.length > 0"
            class="result-count"
          >共 {{ currentList.length }} 项</span>
          <el-button
            size="small"
            text
            :disabled="!currentList.length"
            @click="handleExport"
          >
            <el-icon><Icon icon="mdi:download" /></el-icon>
            导出
          </el-button>
        </div>
      </section>

      <!-- 容器列表 -->
      <section class="docker-table-wrap">
        <div
          v-if="!currentLoaded && !isLoading"
          class="empty-state"
        >
          <el-icon size="40">
            <Icon icon="mdi:docker" />
          </el-icon>
          <p>点击「刷新」加载 Docker {{ activeTabLabel }}信息</p>
        </div>

        <!-- 容器表格 -->
        <el-table
          v-if="loadedByTab.containers && activeTab === 'containers'"
          v-loading="isLoading"
          :data="containers"
          stripe
          border
          size="small"
          height="100%"
          highlight-current-row
        >
          <el-table-column
            prop="id"
            label="ID"
            width="120"
            show-overflow-tooltip
          />
          <el-table-column
            prop="name"
            label="名称"
            width="160"
            show-overflow-tooltip
          />
          <el-table-column
            prop="image"
            label="镜像"
            min-width="180"
            show-overflow-tooltip
          />
          <el-table-column
            prop="status"
            label="状态"
            width="150"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              <el-tag
                size="small"
                :type="statusTag(row.status)"
              >
                {{ row.status }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            prop="ports"
            label="端口"
            width="180"
            show-overflow-tooltip
          />
          <el-table-column
            label="操作"
            width="320"
            fixed="right"
          >
            <template #default="{ row }">
              <el-button
                size="small"
                text
                :disabled="isContainerPending(row)"
                @click="handleInspect(row.id || row.name)"
              >
                详情
              </el-button>
              <el-button
                size="small"
                text
                :disabled="isContainerPending(row)"
                @click="handleLogs(row.id || row.name)"
              >
                日志
              </el-button>
              <el-button
                size="small"
                text
                :disabled="!isUp(row.status) || isContainerPending(row)"
                @click="openContainerTerminal(row)"
              >
                <el-icon><Icon icon="mdi:console" /></el-icon>终端
              </el-button>
              <el-dropdown
                size="small"
                trigger="click"
                @command="(cmd) => handleLifecycle(cmd, row)"
              >
                <el-button
                  size="small"
                  text
                  :loading="isContainerPending(row)"
                  :disabled="isContainerPending(row)"
                >
                  更多<el-icon class="el-icon--right">
                    <Icon icon="mdi:chevron-down" />
                  </el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item
                      command="start"
                      :disabled="isUp(row.status)"
                    >
                      <el-icon><Icon icon="mdi:play" /></el-icon>启动
                    </el-dropdown-item>
                    <el-dropdown-item
                      command="stop"
                      :disabled="!isUp(row.status)"
                    >
                      <el-icon><Icon icon="mdi:stop" /></el-icon>停止
                    </el-dropdown-item>
                    <el-dropdown-item command="restart">
                      <el-icon><Icon icon="mdi:restart" /></el-icon>重启
                    </el-dropdown-item>
                    <el-dropdown-item
                      divided
                      command="pause"
                      :disabled="!isUp(row.status) || isPaused(row.status)"
                    >
                      <el-icon><Icon icon="mdi:pause" /></el-icon>暂停
                    </el-dropdown-item>
                    <el-dropdown-item
                      command="unpause"
                      :disabled="!isPaused(row.status)"
                    >
                      <el-icon><Icon icon="mdi:play-pause" /></el-icon>恢复
                    </el-dropdown-item>
                    <el-dropdown-item
                      divided
                      command="remove"
                      style="color: var(--el-color-danger)"
                    >
                      <el-icon><Icon icon="mdi:delete" /></el-icon>删除
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </template>
          </el-table-column>
        </el-table>

        <!-- 镜像表格 -->
        <el-table
          v-if="loadedByTab.images && activeTab === 'images'"
          v-loading="isLoading"
          :data="images"
          stripe
          border
          size="small"
          height="100%"
          highlight-current-row
        >
          <el-table-column
            prop="repository"
            label="仓库"
            min-width="250"
            show-overflow-tooltip
          />
          <el-table-column
            prop="tag"
            label="标签"
            width="120"
          />
          <el-table-column
            prop="id"
            label="ID"
            width="140"
            show-overflow-tooltip
          />
          <el-table-column
            prop="size"
            label="大小"
            width="100"
          />
          <el-table-column
            prop="created"
            label="创建时间"
            width="200"
            show-overflow-tooltip
          />
          <el-table-column
            label="操作"
            width="80"
            fixed="right"
          >
            <template #default="{ row }">
              <el-popconfirm
                title="确认删除此镜像？"
                confirm-button-text="删除"
                cancel-button-text="取消"
                @confirm="handleRemoveImage(row)"
              >
                <template #reference>
                  <el-button
                    size="small"
                    text
                    type="danger"
                    :loading="isActionPending('remove-image', getDockerResourceId(row, 'image'))"
                  >
                    删除
                  </el-button>
                </template>
              </el-popconfirm>
            </template>
          </el-table-column>
        </el-table>

        <!-- 网络表格 -->
        <el-table
          v-if="loadedByTab.networks && activeTab === 'networks'"
          v-loading="isLoading"
          :data="networks"
          stripe
          border
          size="small"
          height="100%"
          highlight-current-row
        >
          <el-table-column
            prop="id"
            label="ID"
            width="140"
            show-overflow-tooltip
          />
          <el-table-column
            prop="name"
            label="名称"
            min-width="200"
          />
          <el-table-column
            prop="driver"
            label="驱动"
            width="120"
          />
          <el-table-column
            prop="scope"
            label="范围"
            width="100"
          />
        </el-table>
      </section>

      <!-- 内嵌容器终端面板 -->
      <section
        v-if="terminalActive"
        class="docker-terminal-panel"
      >
        <div class="terminal-panel-header">
          <div class="terminal-panel-info">
            <el-icon><Icon icon="mdi:console" /></el-icon>
            <span class="terminal-panel-title">{{ terminalContainerName }}</span>
            <el-tag
              size="small"
              effect="plain"
              type="info"
            >
              {{ terminalContainerId.slice(0, 12) }}
            </el-tag>
            <span
              :class="['terminal-status-dot', terminalReady ? 'is-connected' : 'is-connecting']"
            />
            <span class="terminal-status-text">{{ terminalReady ? '已连接' : '连接中...' }}</span>
          </div>
          <div class="terminal-panel-actions">
            <el-button
              size="small"
              text
              @click="closeContainerTerminal"
            >
              <el-icon><Icon icon="mdi:close" /></el-icon>
              关闭
            </el-button>
          </div>
        </div>
        <div class="terminal-panel-body">
          <TerminalViewport
            :key="terminalProcessId"
            ref="containerViewportRef"
            :active="terminalActive"
            @ready="handleContainerTerminalReady"
            @input="handleContainerTerminalInput"
          />
        </div>
      </section>
    </div>

    <DockerInfoDialog
      v-model:visible="dialogVisible"
      :title="dialogTitle"
      :content="dialogContent"
      :loading="dialogLoading"
      @closed="handleInfoDialogClosed"
    />
    <DockerRemoveDialog
      v-model:visible="removeDialogVisible"
      :container-id="removeTarget"
      :loading="isActionPending('remove-container', removeTarget)"
      @confirm="confirmRemoveContainer"
    />
  </div>
</template>

<script setup>
import { computed, reactive, ref, toRef, watch } from 'vue'
import { Icon } from '@iconify/vue'
import {
  getDockerContainerLogsApi,
  execCommandApi,
  inspectDockerContainerApi,
  listDockerContainersApi,
  listDockerImagesApi,
  listDockerNetworksApi,
  pauseDockerContainerApi,
  removeDockerContainerApi,
  removeDockerImageApi,
  restartDockerContainerApi,
  startDockerContainerApi,
  stopDockerContainerApi,
  unpauseDockerContainerApi
} from '@/services/api.js'
import { showError, showSuccess } from '@/utils/messageUtils.js'
import { exportTsv } from '@/utils/exportUtils.js'
import { createLatestRequestGuard } from '@/utils/latestRequestGuard.js'
import TerminalViewport from '@/components/PuppetConsole/terminal/TerminalViewport.vue'
import DockerInfoDialog from './DockerInfoDialog.vue'
import DockerRemoveDialog from './DockerRemoveDialog.vue'
import {
  DOCKER_TAB_CONFIG,
  formatDockerInfo,
  getDockerExportConfig,
  getDockerResourceId,
  getDockerStatusTag,
  isDockerContainerPaused,
  isDockerContainerRunning,
  normalizeDockerList,
  unwrapDockerResponse
} from './dockerManagerModel.js'
import { useDockerTerminal } from './useDockerTerminal.js'

const props = defineProps({
  sessionId: { type: String, required: true }
})

const sessionIdRef = toRef(props, 'sessionId')
const requestGuard = createLatestRequestGuard(['containers', 'images', 'networks', 'dialog'])
const activeTab = ref('containers')
const showAll = ref(true)
const loadedByTab = reactive({ containers: false, images: false, networks: false })
const loadingByTab = reactive({ containers: false, images: false, networks: false })
const containers = ref([])
const images = ref([])
const networks = ref([])
const listsByTab = { containers, images, networks }

const dialogVisible = ref(false)
const dialogTitle = ref('')
const dialogContent = ref('')
const dialogLoading = ref(false)

const removeDialogVisible = ref(false)
const removeTarget = ref('')
const pendingActions = ref(new Set())

const {
  terminalActive,
  terminalReady,
  terminalContainerId,
  terminalContainerName,
  terminalProcessId,
  containerViewportRef,
  openContainerTerminal,
  closeContainerTerminal,
  handleContainerTerminalReady,
  handleContainerTerminalInput
} = useDockerTerminal({ sessionId: sessionIdRef, executeCommand: execCommandApi })

const currentList = computed(() => listsByTab[activeTab.value]?.value || [])
const currentLoaded = computed(() => loadedByTab[activeTab.value])
const isLoading = computed(() => loadingByTab[activeTab.value])
const activeTabLabel = computed(() => DOCKER_TAB_CONFIG[activeTab.value]?.label || '')

const CONTAINER_ACTIONS = Object.freeze({
  start: { api: startDockerContainerApi, label: '启动', params: {} },
  stop: { api: stopDockerContainerApi, label: '停止', params: { timeout: 10 } },
  restart: { api: restartDockerContainerApi, label: '重启', params: { timeout: 10 } },
  pause: { api: pauseDockerContainerApi, label: '暂停', params: {} },
  unpause: { api: unpauseDockerContainerApi, label: '恢复', params: {} }
})

function getErrorMessage(error) {
  return error?.message || String(error)
}

async function refreshTab(tab = activeTab.value, { notify = true } = {}) {
  const targetList = listsByTab[tab]
  if (!targetList || !props.sessionId) return

  const sequence = requestGuard.next(tab)
  const capturedSessionId = props.sessionId
  const capturedShowAll = showAll.value
  loadingByTab[tab] = true

  try {
    let response
    if (tab === 'containers') {
      response = await listDockerContainersApi({
        sessionId: capturedSessionId,
        all: capturedShowAll
      })
    } else if (tab === 'images') {
      response = await listDockerImagesApi({ sessionId: capturedSessionId })
    } else {
      response = await listDockerNetworksApi({ sessionId: capturedSessionId })
    }

    if (!requestGuard.isCurrent(tab, sequence) || props.sessionId !== capturedSessionId) return
    targetList.value = normalizeDockerList(response, tab)
    loadedByTab[tab] = true
  } catch (error) {
    if (!requestGuard.isCurrent(tab, sequence) || props.sessionId !== capturedSessionId) return
    if (notify) {
      showError(`获取 Docker ${DOCKER_TAB_CONFIG[tab].label}失败: ${getErrorMessage(error)}`)
    }
  } finally {
    if (requestGuard.isCurrent(tab, sequence)) loadingByTab[tab] = false
  }
}

function handleRefresh() {
  return refreshTab(activeTab.value)
}

function handleTabChange(tab) {
  if (!loadedByTab[tab]) refreshTab(tab)
}

function handleShowAllChange() {
  refreshTab('containers')
}

async function loadInfoDialog(type, containerId) {
  const isLogs = type === 'logs'
  const sequence = requestGuard.next('dialog')
  const capturedSessionId = props.sessionId
  dialogTitle.value = `${isLogs ? '容器日志' : '容器详情'} — ${containerId}`
  dialogContent.value = ''
  dialogLoading.value = true
  dialogVisible.value = true

  try {
    const response = isLogs
      ? await getDockerContainerLogsApi({
          sessionId: capturedSessionId,
          containerId,
          tail: 200
        })
      : await inspectDockerContainerApi({ sessionId: capturedSessionId, containerId })

    if (
      !requestGuard.isCurrent('dialog', sequence) ||
      props.sessionId !== capturedSessionId ||
      !dialogVisible.value
    ) {
      return
    }
    dialogContent.value = formatDockerInfo(
      response,
      isLogs ? 'logs' : 'inspect',
      isLogs ? '(无日志)' : '{}'
    )
  } catch (error) {
    if (
      requestGuard.isCurrent('dialog', sequence) &&
      props.sessionId === capturedSessionId &&
      dialogVisible.value
    ) {
      dialogContent.value = `获取${isLogs ? '日志' : '详情'}失败: ${getErrorMessage(error)}`
    }
  } finally {
    if (requestGuard.isCurrent('dialog', sequence)) dialogLoading.value = false
  }
}

function handleInspect(containerId) {
  loadInfoDialog('inspect', containerId)
}

function handleLogs(containerId) {
  loadInfoDialog('logs', containerId)
}

function handleInfoDialogClosed() {
  requestGuard.invalidate(['dialog'])
  dialogLoading.value = false
  dialogContent.value = ''
}

function getActionKey(type, resourceId, sessionId = props.sessionId) {
  return `${sessionId}:${type}:${resourceId}`
}

function beginAction(key) {
  if (pendingActions.value.has(key)) return false
  pendingActions.value = new Set([...pendingActions.value, key])
  return true
}

function finishAction(key) {
  const next = new Set(pendingActions.value)
  next.delete(key)
  pendingActions.value = next
}

function isActionPending(type, resourceId) {
  return pendingActions.value.has(getActionKey(type, resourceId))
}

function isContainerPending(row) {
  const id = getDockerResourceId(row)
  const sessionPrefix = `${props.sessionId}:`
  return [...pendingActions.value].some(
    (key) => key.startsWith(sessionPrefix) && key.endsWith(`:${id}`)
  )
}

async function handleLifecycle(command, row) {
  const containerId = getDockerResourceId(row)
  if (!containerId) return
  if (command === 'remove') {
    removeTarget.value = containerId
    removeDialogVisible.value = true
    return
  }

  const action = CONTAINER_ACTIONS[command]
  if (!action) return
  const capturedSessionId = props.sessionId
  const key = getActionKey(command, containerId, capturedSessionId)
  if (!beginAction(key)) return

  try {
    const response = await action.api({
      sessionId: capturedSessionId,
      containerId,
      ...action.params
    })
    const data = unwrapDockerResponse(response)
    if (props.sessionId !== capturedSessionId) return
    if (data.success) {
      showSuccess(`${action.label}容器成功: ${containerId}`)
      await refreshTab('containers', { notify: false })
    } else {
      showError(`${action.label}容器失败: ${data.output || '未知错误'}`)
    }
  } catch (error) {
    if (props.sessionId === capturedSessionId) {
      showError(`${action.label}容器失败: ${getErrorMessage(error)}`)
    }
  } finally {
    finishAction(key)
  }
}

async function confirmRemoveContainer({ containerId, force }) {
  const capturedSessionId = props.sessionId
  const key = getActionKey('remove-container', containerId, capturedSessionId)
  if (!beginAction(key)) return

  try {
    const response = await removeDockerContainerApi({
      sessionId: capturedSessionId,
      containerId,
      force
    })
    const data = unwrapDockerResponse(response)
    if (props.sessionId !== capturedSessionId) return
    if (data.success) {
      showSuccess(`删除容器成功: ${containerId}`)
      removeDialogVisible.value = false
      await refreshTab('containers', { notify: false })
    } else {
      showError(`删除容器失败: ${data.output || '未知错误'}`)
    }
  } catch (error) {
    if (props.sessionId === capturedSessionId) {
      showError(`删除容器失败: ${getErrorMessage(error)}`)
    }
  } finally {
    finishAction(key)
  }
}

async function handleRemoveImage(row) {
  const imageId = getDockerResourceId(row, 'image')
  if (!imageId) return
  const capturedSessionId = props.sessionId
  const key = getActionKey('remove-image', imageId, capturedSessionId)
  if (!beginAction(key)) return

  try {
    const response = await removeDockerImageApi({
      sessionId: capturedSessionId,
      imageId,
      force: false
    })
    const data = unwrapDockerResponse(response)
    if (props.sessionId !== capturedSessionId) return
    if (data.success) {
      showSuccess(`删除镜像成功: ${imageId}`)
      await refreshTab('images', { notify: false })
    } else {
      showError(`删除镜像失败: ${data.output || '可能有容器引用'}`)
    }
  } catch (error) {
    if (props.sessionId === capturedSessionId) {
      showError(`删除镜像失败: ${getErrorMessage(error)}`)
    }
  } finally {
    finishAction(key)
  }
}

function handleExport() {
  const config = getDockerExportConfig(activeTab.value)
  if (!config || currentList.value.length === 0) return
  exportTsv(currentList.value, config.filename, config.columns)
}

watch(
  () => props.sessionId,
  (sessionId) => {
    requestGuard.invalidate()
    Object.keys(loadedByTab).forEach((tab) => {
      loadedByTab[tab] = false
      loadingByTab[tab] = false
      listsByTab[tab].value = []
    })
    pendingActions.value = new Set()
    dialogVisible.value = false
    dialogLoading.value = false
    removeDialogVisible.value = false
    removeTarget.value = ''
    closeContainerTerminal()
    if (sessionId) refreshTab('containers', { notify: false })
  },
  { immediate: true }
)

const isUp = isDockerContainerRunning
const isPaused = isDockerContainerPaused
const statusTag = getDockerStatusTag
</script>

<style scoped>
.docker-workbench {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
}

.docker-shell {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.docker-shell.has-terminal .docker-table-wrap {
  flex: 1;
  min-height: 120px;
}

.docker-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  gap: 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color-page);
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.result-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.docker-table-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--el-text-color-placeholder);
  gap: 12px;
  padding: 40px;
}

.empty-state p {
  font-size: 13px;
}

/* 内嵌终端面板 */
.docker-terminal-panel {
  height: 320px;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  border-top: 2px solid var(--el-color-primary);
}

.terminal-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: var(--el-bg-color-page);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.terminal-panel-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--el-text-color-regular);
}

.terminal-panel-title {
  font-weight: 600;
  font-size: 13px;
}

.terminal-panel-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.terminal-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.terminal-status-dot.is-connected {
  background: var(--el-color-success);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--el-color-success) 20%, transparent);
}

.terminal-status-dot.is-connecting {
  background: var(--el-color-warning);
  animation: blink 1s ease-in-out infinite;
}

.terminal-status-text {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.terminal-panel-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.terminal-panel-body :deep(.terminal-viewport) {
  border-radius: 0;
  border: none;
}

.terminal-panel-body :deep(.terminal-viewport__chrome) {
  display: none;
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}
</style>
