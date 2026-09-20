<template>
  <div class="proxy-panel reverse-tunnel">
    <!-- Add rule form -->
    <section class="workspace-strip">
      <div class="workspace-status">
        <span class="workspace-title">添加反向隧道</span>
      </div>

      <div class="workspace-actions">
        <div class="rule-form">
          <div class="form-field">
            <span class="control-label">绑定地址</span>
            <el-input
              v-model="addForm.bindAddr"
              aria-label="绑定地址"
              placeholder="127.0.0.1"
              clearable
            />
          </div>
          <div class="form-field">
            <span class="control-label">puppet 监听端口</span>
            <el-input-number
              v-model="addForm.remoteListenPort"
              aria-label="节点监听端口"
              :min="1"
              :max="65535"
              :precision="0"
              controls-position="right"
              placeholder="puppet 端口"
            />
          </div>
          <div class="form-field">
            <span class="control-label">转发目标主机</span>
            <el-input
              v-model="addForm.forwardHost"
              aria-label="转发目标主机"
              placeholder="127.0.0.1"
              clearable
            />
          </div>
          <div class="form-field">
            <span class="control-label">转发目标端口</span>
            <el-input-number
              v-model="addForm.forwardPort"
              aria-label="转发目标端口"
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
          添加隧道
        </el-button>
      </div>
    </section>

    <!-- Rules list -->
    <section class="rules-panel">
      <div class="rules-head">
        <div class="rules-copy">
          <span class="connections-title">隧道列表</span>
          <span class="connections-subtitle">
            类似 ssh -R，在 puppet 端监听，把进入的连接转发到 C2 侧目标
          </span>
        </div>
        <div class="list-actions">
          <span class="list-count">{{ rules.length }} 条隧道</span>
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
            label="puppet 端口"
            width="120"
            align="center"
          >
            <template #default="{ row }">
              <el-tag
                size="small"
                type="primary"
                effect="plain"
              >
                {{ row.remoteListenPort }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column
            label="ID"
            width="100"
            align="center"
          >
            <template #default="{ row }">
              <el-tooltip
                :content="row.listenId"
                placement="top"
                :show-after="300"
              >
                <span class="muted-text mono-text">{{ row.listenId?.slice(0, 8) }}</span>
              </el-tooltip>
            </template>
          </el-table-column>

          <el-table-column
            label="绑定地址"
            prop="bindAddr"
            width="130"
            align="center"
          >
            <template #default="{ row }">
              <span class="muted-text">{{ row.bindAddr || '127.0.0.1' }}</span>
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
            label="转发目标"
            min-width="180"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              {{ row.forwardHost }}:{{ row.forwardPort }}
            </template>
          </el-table-column>

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
            label="启动时间"
            width="150"
            align="center"
          >
            <template #default="{ row }">
              <span class="muted-text">{{ row.startTime ? formatTime(row.startTime) : '-' }}</span>
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
                :loading="stoppingId === row.listenId"
                @click="handleStop(row.listenId)"
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
        <p>暂无反向隧道</p>
        <span>填写上方配置，添加第一条规则。</span>
      </div>
    </section>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { icons } from '@/utils/icons.js'
import {
  listReverseTunnelsApi,
  startReverseTunnelApi,
  stopAllReverseTunnelsApi,
  stopReverseTunnelApi
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
const stoppingId = ref(null)

const addForm = ref({
  remoteListenPort: 8080,
  bindAddr: '127.0.0.1',
  forwardHost: '',
  forwardPort: 4444
})

const fetchRules = async () => {
  try {
    const res = await listReverseTunnelsApi({ sessionId: props.sessionId })
    rules.value = res.data ?? []
    emit('rules-change', rules.value.length)
  } catch {
    // silently ignore
  }
}

const handleAdd = async () => {
  const { remoteListenPort, bindAddr, forwardHost, forwardPort } = addForm.value
  if (!remoteListenPort || remoteListenPort < 1 || remoteListenPort > 65535) {
    showWarning('请输入有效的 puppet 监听端口（1-65535）')
    return
  }
  if (!forwardHost || !forwardHost.trim()) {
    showWarning('请输入转发目标主机地址')
    return
  }
  if (!forwardPort || forwardPort < 1 || forwardPort > 65535) {
    showWarning('请输入有效的转发目标端口（1-65535）')
    return
  }

  adding.value = true
  try {
    await executeRequest(
      async () =>
        startReverseTunnelApi({
          sessionId: props.sessionId,
          remoteListenPort,
          bindAddr: bindAddr?.trim() || '127.0.0.1',
          forwardHost: forwardHost.trim(),
          forwardPort
        }),
      {
        loadingRef: adding,
        successMessage: `反向隧道已添加：puppet:${remoteListenPort} → ${forwardHost}:${forwardPort}`,
        errorMessage: '添加反向隧道失败'
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

const handleStop = async (listenId) => {
  stoppingId.value = listenId
  try {
    await executeRequest(
      async () => stopReverseTunnelApi({ sessionId: props.sessionId, listenId }),
      {
        successMessage: '反向隧道已删除',
        errorMessage: '删除反向隧道失败'
      }
    )
    await fetchRules()
    if (rules.value.length === 0) emit('status-change', 'stopped')
  } catch {
    // error handled
  } finally {
    stoppingId.value = null
  }
}

const handleStopAll = async () => {
  stoppingAll.value = true
  try {
    await executeRequest(
      async () => stopAllReverseTunnelsApi({ sessionId: props.sessionId }),
      {
        loadingRef: stoppingAll,
        successMessage: '所有反向隧道已清除',
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

const formatTime = (ms) => {
  if (!ms) return '-'
  const d = new Date(ms)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
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
