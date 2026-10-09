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
              :disabled="busy"
              aria-label="绑定地址"
              placeholder="127.0.0.1"
              clearable
            />
          </div>
          <div class="form-field">
            <span class="control-label">agent 监听端口</span>
            <el-input-number
              v-model="addForm.remoteListenPort"
              :disabled="busy"
              aria-label="节点监听端口"
              :min="1"
              :max="65535"
              :precision="0"
              controls-position="right"
              placeholder="agent 端口"
            />
          </div>
          <div class="form-field">
            <span class="control-label">转发目标主机</span>
            <el-input
              v-model="addForm.forwardHost"
              :disabled="busy"
              aria-label="转发目标主机"
              placeholder="127.0.0.1"
              clearable
            />
          </div>
          <div class="form-field">
            <span class="control-label">转发目标端口</span>
            <el-input-number
              v-model="addForm.forwardPort"
              :disabled="busy"
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
          :disabled="busy && !adding"
          class="primary-action"
          @click="handleAdd"
        >
          <el-icon><Icon :icon="iconMap.add" /></el-icon>
          添加隧道
        </el-button>
      </div>
    </section>

    <el-alert
      v-if="errorMessage"
      :title="errorMessage"
      type="error"
      :closable="false"
      show-icon
    />

    <!-- Rules list -->
    <section class="rules-panel">
      <div class="rules-head">
        <div class="rules-copy">
          <span class="connections-title">隧道列表</span>
          <span class="connections-subtitle">
            类似 ssh -R，在 agent 端监听，把进入的连接转发到 C2 侧目标
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
            :disabled="busy && !stoppingAll"
            @click="handleStopAll"
          >
            <el-icon><Icon :icon="iconMap.stop" /></el-icon>
            清除全部
          </el-button>

          <el-button
            text
            size="small"
            :loading="refreshing"
            :disabled="busy"
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
            label="agent 端口"
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
            width="130"
            align="center"
          >
            <template #default="{ row }">
              <el-tag
                size="small"
                :type="row.running ? 'success' : row.cleanupPending ? 'warning' : 'info'"
                effect="plain"
              >
                {{
                  row.running
                    ? '运行中'
                    : row.cleanupPending
                      ? '远端待确认'
                      : row.state === 'starting'
                        ? '启动中'
                        : '已停止'
                }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column
            label="启动时间"
            width="150"
            align="center"
          >
            <template #default="{ row }">
              <span class="muted-text">{{ row.startTime ? formatDate(row.startTime) : '-' }}</span>
            </template>
          </el-table-column>

          <el-table-column
            label="操作"
            width="130"
            align="center"
          >
            <template #default="{ row }">
              <el-button
                type="danger"
                size="small"
                text
                :loading="stoppingKey === row.listenId"
                :disabled="busy && stoppingKey !== row.listenId"
                @click="handleStop(row.listenId)"
              >
                <el-icon><Icon :icon="iconMap.delete" /></el-icon>
                {{ row.cleanupPending ? '重试清理' : '删除' }}
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
import { Icon } from '@iconify/vue'
import { icons as iconMap } from '@/utils/icons.js'
import { useProxyRules } from '@/composables/useProxyRules.js'
import { formatDate } from '@/utils/format.js'

const props = defineProps({ sessionId: { type: String, required: true } })
const emit = defineEmits(['status-change', 'rules-change'])
const {
  rules,
  addForm,
  busy,
  adding,
  stoppingAll,
  stoppingKey,
  refreshing,
  errorMessage,
  fetchRules,
  handleAdd,
  handleStop,
  handleStopAll
} = useProxyRules('reverse', () => props.sessionId, emit)
</script>

<style scoped src="./proxy-panel.css"></style>
