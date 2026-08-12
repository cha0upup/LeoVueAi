<template>
  <div class="local-forward">
    <!-- Add rule form -->
    <section class="workspace-strip">
      <div class="workspace-status">
        <span class="workspace-title">本地端口转发</span>
        <el-tag
          effect="plain"
          round
          size="small"
          type="info"
        >
          {{ rules.length }} 条规则
        </el-tag>
      </div>

      <div class="workspace-actions">
        <div class="rule-form">
          <div class="form-field">
            <span class="control-label">本地端口</span>
            <el-input-number
              v-model="addForm.localPort"
              :min="1024"
              :max="65535"
              :precision="0"
              controls-position="right"
              placeholder="本地端口"
            />
          </div>
          <span class="arrow-sep">→</span>
          <div class="form-field">
            <span class="control-label">目标主机</span>
            <el-input
              v-model="addForm.targetHost"
              placeholder="192.168.1.1"
              style="width: 160px"
              clearable
            />
          </div>
          <div class="form-field">
            <span class="control-label">目标端口</span>
            <el-input-number
              v-model="addForm.targetPort"
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
          <span class="connections-title">转发规则</span>
          <span class="connections-subtitle">
            类似 ssh -L，将本地端口透明转发到 puppet 端可访问的目标
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
        class="idle-shell"
      >
        <el-empty
          :image-size="88"
        >
          <template #description>
            <span>暂无转发规则，填写上方表单添加第一条规则。</span>
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

<style scoped>
.local-forward {
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
