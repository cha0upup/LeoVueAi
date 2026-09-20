<template>
  <div class="proxy-panel local-forward">
    <!-- Add rule form -->
    <section class="workspace-strip">
      <div class="workspace-status">
        <span class="workspace-title">添加转发规则</span>
      </div>

      <div class="workspace-actions">
        <div class="rule-form">
          <BindAddressInput
            v-model="addForm.bindAddr"
            :disabled="adding"
            stacked
          />
          <div class="form-field">
            <span class="control-label">本地端口</span>
            <el-input-number
              v-model="addForm.localPort"
              aria-label="本地端口"
              :min="1024"
              :max="65535"
              :precision="0"
              controls-position="right"
              placeholder="本地端口"
            />
          </div>
          <div class="form-field">
            <span class="control-label">目标主机</span>
            <el-input
              v-model="addForm.targetHost"
              aria-label="目标主机"
              placeholder="192.168.1.1"
              clearable
            />
          </div>
          <div class="form-field">
            <span class="control-label">目标端口</span>
            <el-input-number
              v-model="addForm.targetPort"
              aria-label="目标端口"
              :min="1"
              :max="65535"
              :precision="0"
              controls-position="right"
              placeholder="目标端口"
            />
          </div>
        </div>

        <el-button
          type="primary"
          :loading="adding"
          class="primary-action"
          @click="handleAdd"
        >
          <el-icon><Icon :icon="iconMap.add" /></el-icon>
          添加规则
        </el-button>
      </div>
    </section>

    <!-- Rules list -->
    <section class="rules-panel">
      <div class="rules-head">
        <div class="rules-copy">
          <span class="connections-title">转发规则</span>
          <span class="connections-subtitle">
            类似 ssh -L，将本地端口透明转发到 puppet 端可访问的目标
          </span>
        </div>
        <div class="list-actions">
          <span class="list-count">{{ rules.length }} 条规则</span>
          <el-button
            v-if="rules.length > 0"
            type="danger"
            text
            size="small"
            :loading="stoppingAll"
            @click="handleStopAll"
          >
            <el-icon><Icon :icon="iconMap.stop" /></el-icon>
            清除全部
          </el-button>

          <el-button
            text
            size="small"
            @click="fetchRules"
          >
            <el-icon><Icon :icon="iconMap.refresh" /></el-icon>
            刷新
          </el-button>
        </div>
      </div>

      <div
        v-if="rules.length"
        class="table-shell"
      >
        <el-table
          :data="rules"
          style="width: 100%"
        >
          <el-table-column
            label="监听地址"
            prop="bindAddr"
            min-width="180"
            show-overflow-tooltip
          />
          <el-table-column
            label="本地端口"
            prop="localPort"
            width="120"
            align="center"
          >
            <template #default="{ row }">
              <el-tag
                size="small"
                type="primary"
                effect="plain"
              >
                {{ row.localPort }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column
            label=""
            width="44"
            align="center"
          >
            <template #default>
              <span class="arrow-icon">→</span>
            </template>
          </el-table-column>

          <el-table-column
            label="目标主机"
            prop="targetHost"
            min-width="180"
            show-overflow-tooltip
          />

          <el-table-column
            label="目标端口"
            prop="targetPort"
            width="100"
            align="center"
          />

          <el-table-column
            label="状态"
            width="100"
            align="center"
          >
            <template #default="{ row }">
              <el-tag
                size="small"
                :type="row.running ? 'success' : 'danger'"
                effect="plain"
              >
                {{ row.running ? '运行中' : '已停止' }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column
            label="操作"
            width="100"
            align="center"
          >
            <template #default="{ row }">
              <el-button
                type="danger"
                size="small"
                text
                :loading="stoppingPort === row.localPort"
                @click="handleStop(row.localPort)"
              >
                <el-icon><Icon :icon="iconMap.delete" /></el-icon>
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div
        v-else
        class="empty-state"
      >
        <el-icon aria-hidden="true">
          <Icon :icon="iconMap.network" />
        </el-icon>
        <p>暂无转发规则</p>
        <span>填写上方配置，添加第一条规则。</span>
      </div>
    </section>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import BindAddressInput from './BindAddressInput.vue'
import { icons } from '@/utils/icons.js'
import {
  listLocalForwardsApi,
  startLocalForwardApi,
  stopAllLocalForwardsApi,
  stopLocalForwardApi
} from '@/services/api.js'
import { executeRequest } from '@/utils/apiUtils.js'
import { Icon } from '@iconify/vue'
import { showWarning } from '@/utils/messageUtils.js'

const iconMap = icons

const props = defineProps({
  sessionId: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['status-change', 'rules-change'])

const rules = ref([])
const adding = ref(false)
const stoppingAll = ref(false)
const stoppingPort = ref(null)

const addForm = ref({
  bindAddr: '0.0.0.0',
  localPort: 8888,
  targetHost: '',
  targetPort: 80
})

const fetchRules = async () => {
  try {
    const res = await listLocalForwardsApi({ sessionId: props.sessionId })
    rules.value = res.data ?? []
    emit('rules-change', rules.value.length)
  } catch {
    // silently ignore
  }
}

const handleAdd = async () => {
  const { localPort, targetHost, targetPort } = addForm.value
  const bindAddr = addForm.value.bindAddr.trim()
  if (!bindAddr) {
    showWarning('请选择或输入监听地址')
    return
  }
  if (!localPort || localPort < 1024 || localPort > 65535) {
    showWarning('请输入有效的本地端口号（1024-65535）')
    return
  }
  if (!targetHost || !targetHost.trim()) {
    showWarning('请输入目标主机地址')
    return
  }
  if (!targetPort || targetPort < 1 || targetPort > 65535) {
    showWarning('请输入有效的目标端口号（1-65535）')
    return
  }

  adding.value = true
  try {
    await executeRequest(
      async () =>
        startLocalForwardApi({
          sessionId: props.sessionId,
          localPort,
          bindAddr,
          targetHost: targetHost.trim(),
          targetPort
        }),
      {
        loadingRef: adding,
        successMessage: `转发规则已添加：${localPort} → ${targetHost}:${targetPort}`,
        errorMessage: '添加转发规则失败'
      }
    )
    await fetchRules()
    emit('status-change', 'running')
  } catch {
    // error handled by executeRequest
  } finally {
    adding.value = false
  }
}

const handleStop = async (localPort) => {
  stoppingPort.value = localPort
  try {
    await executeRequest(
      async () => stopLocalForwardApi({ sessionId: props.sessionId, localPort }),
      {
        successMessage: `转发规则已删除：本地端口 ${localPort}`,
        errorMessage: '删除转发规则失败'
      }
    )
    await fetchRules()
    if (rules.value.length === 0) emit('status-change', 'stopped')
  } catch {
    // error handled
  } finally {
    stoppingPort.value = null
  }
}

const handleStopAll = async () => {
  stoppingAll.value = true
  try {
    await executeRequest(
      async () => stopAllLocalForwardsApi({ sessionId: props.sessionId }),
      {
        loadingRef: stoppingAll,
        successMessage: '所有转发规则已清除',
        errorMessage: '清除失败'
      }
    )
    rules.value = []
    emit('status-change', 'stopped')
    emit('rules-change', 0)
  } catch {
    // error handled
  } finally {
    stoppingAll.value = false
  }
}

onMounted(async () => {
  await fetchRules()
  if (rules.value.length > 0) {
    emit('status-change', 'running')
  } else {
    emit('status-change', 'stopped')
  }
})
</script>

<style scoped src="./proxy-panel.css"></style>
