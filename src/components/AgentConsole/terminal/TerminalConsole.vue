<template>
  <TerminalWorkspaceView
    :session-id="sessionId"
    :workspace="workspace"
    title="主机终端"
  >
    <template #actions>
      <el-button
        type="primary"
        size="small"
        aria-label="新建主机终端"
        :disabled="!agentTerminalAvailable"
        @click="workspace.createSession()"
      >
        <Icon :icon="icons.plus" /> 新建终端
      </el-button>
      <el-dropdown
        v-if="workspace.terminalModeOptions.value.length"
        trigger="click"
        @command="workspace.createSession"
      >
        <el-button
          text
          aria-label="选择主机终端模式"
        >
          <Icon :icon="icons.arrowDown" />
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item
              v-for="option in workspace.terminalModeOptions.value"
              :key="option.value"
              :command="option.value"
              :disabled="option.disabled"
            >
              {{ option.label }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </template>
    <template #empty>
      <Icon :icon="icons.terminal" />
      <h3>主机终端</h3>
      <p>在当前 Agent 所在主机运行命令。</p>
      <el-button
        type="primary"
        :disabled="!agentTerminalAvailable"
        @click="workspace.createSession()"
      >
        新建终端
      </el-button>
    </template>
  </TerminalWorkspaceView>
</template>
<script setup>
import { computed, inject, onUnmounted, ref, toRef, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { icons } from '@/utils/icons.js'
import { execCommandApi } from '@/services/api/agent-node.js'
import { showError } from '@/utils/messageUtils.js'
import TerminalWorkspaceView from './TerminalWorkspaceView.vue'
import { useTerminalWorkspace } from './useTerminalWorkspace.js'
const props = defineProps({ sessionId: { type: String, required: true } })
const runtime = inject('agentRuntime', ref('java'))
const capabilities = inject('agentCapabilities', ref([]))
const updateBadge = inject('updateSidebarBadge', () => {})
const agentTerminalAvailable = computed(
  () => !capabilities.value.length || capabilities.value.includes('terminal')
)
const workspace = useTerminalWorkspace({
  hostSessionId: toRef(props, 'sessionId'),
  runtime,
  executeCommand: execCommandApi,
  agentTerminalAvailable,
  onError: showError
})
watch(
  () => workspace.sessions.value.length,
  (count) => updateBadge('terminal', count || undefined),
  { immediate: true }
)
onUnmounted(() => updateBadge('terminal', undefined))
</script>
