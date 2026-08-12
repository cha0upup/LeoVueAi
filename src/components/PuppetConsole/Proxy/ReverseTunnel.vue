<template>
  <div class="reverse-tunnel">
    <!-- Add rule form -->
    <section class="workspace-strip">
      <div class="workspace-status">
        <span class="workspace-title">反向隧道</span>
        <el-tag
          effect="plain"
          round
          size="small"
          type="info"
        >
          {{ rules.length }} 条隧道
        </el-tag>
      </div>

      <div class="workspace-actions">
        <div class="rule-form">
          <div class="form-field">
            <span class="control-label">puppet 监听端口</span>
            <el-input-number
              v-model="addForm.remoteListenPort"
              :min="1"
              :max="65535"
              :precision="0"
              controls-position="right"
              placeholder="puppet 端口"
            />
          </div>
          <div class="form-field">
            <span class="control-label">绑定地址</span>
            <el-input
              v-model="addForm.bindAddr"
              placeholder="127.0.0.1"
              style="width: 130px"
              clearable
            />
          </div>
          <span class="arrow-sep">→</span>
          <div class="form-field">
            <span class="control-label">转发目标主机</span>
            <el-input
              v-model="addForm.forwardHost"
              placeholder="127.0.0.1"
              style="width: 160px"
              clearable
            />
          </div>
          <div class="form-field">
            <span class="control-label">转发目标端口</span>
            <el-input-number
              v-model="addForm.forwardPort"
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

        <el-button
          v-if="rules.length > 0"
          type="danger"
          plain
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
        class="idle-shell"
      >
        <el-empty :image-size="88">
          <template #description>
            <span>暂无反向隧道，填写上方表单添加第一条规则。</span>
          </template>
        </el-empty>
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

<style scoped>
.reverse-tunnel {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.workspace-strip,
.rules-panel {
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 40%, transparent);
  background: color-mix(in srgb, var(--app-card-background) 94%, var(--el-bg-color-overlay));
  box-shadow: var(--app-card-shadow-soft);
}

.workspace-strip {
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px 14px;
  background: color-mix(
    in srgb,
    var(--app-control-background-soft) 76%,
    var(--app-card-background)
  );
}

.workspace-status {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding-top: 2px;
}

.workspace-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.control-label,
.connections-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--el-color-primary);
}

.connections-subtitle {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

.workspace-actions {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-start;
  min-width: 0;
}

.rule-form {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-field :deep(.el-input-number) {
  width: 130px;
}

.arrow-sep {
  font-size: 18px;
  color: var(--el-text-color-secondary);
  padding-bottom: 4px;
  align-self: flex-end;
}

.primary-action {
  min-width: 110px;
}

.rules-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.rules-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 14px 10px;
  border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 36%, transparent);
}

.rules-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.table-shell,
.idle-shell {
  flex: 1;
  min-height: 0;
  margin: 12px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--app-control-background-soft) 90%, transparent);
  overflow: hidden;
}

.table-shell {
  padding: 8px;
}

.idle-shell {
  display: flex;
  align-items: center;
  justify-content: center;
}

.arrow-icon {
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.muted-text {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.mono-text {
  font-family: var(--el-font-family-mono, monospace);
  font-size: 11px;
  letter-spacing: 0.04em;
}

:deep(.el-table) {
  font-size: 13px;
  --el-table-border-color: color-mix(in srgb, var(--el-border-color) 44%, transparent);
  --el-table-header-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  --el-table-row-hover-bg-color: color-mix(in srgb, var(--app-control-background) 72%, transparent);
  background: transparent;
}

:deep(.el-table th),
:deep(.el-table tr),
:deep(.el-table td),
:deep(.el-table__inner-wrapper::before) {
  background: transparent;
}

:deep(.el-table th) {
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

:deep(.el-empty) {
  padding: 28px 16px;
}

@media (max-width: 980px) {
  .rule-form {
    flex-direction: column;
    align-items: flex-start;
  }

  .arrow-sep {
    display: none;
  }
}

@media (max-width: 720px) {
  .table-shell,
  .idle-shell {
    margin: 10px;
  }
}
</style>
