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
            :disabled="busy"
            stacked
          />
          <div class="form-field">
            <span class="control-label">本地端口</span>
            <el-input-number
              v-model="addForm.localPort"
              :disabled="busy"
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
              :disabled="busy"
              aria-label="目标主机"
              placeholder="192.168.1.1"
              clearable
            />
          </div>
          <div class="form-field">
            <span class="control-label">目标端口</span>
            <el-input-number
              v-model="addForm.targetPort"
              :disabled="busy"
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
          :disabled="busy && !adding"
          class="primary-action"
          @click="handleAdd"
        >
          <el-icon><Icon :icon="iconMap.add" /></el-icon>
          添加规则
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
          <span class="connections-title">转发规则</span>
          <span class="connections-subtitle">
            类似 ssh -L，将本地端口透明转发到 agent 端可访问的目标
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
                :loading="stoppingKey === row.localPort"
                :disabled="busy && stoppingKey !== row.localPort"
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
import { Icon } from '@iconify/vue'
import { icons as iconMap } from '@/utils/icons.js'
import { useProxyRules } from '@/composables/useProxyRules.js'
import BindAddressInput from './BindAddressInput.vue'

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
} = useProxyRules('forward', () => props.sessionId, emit)
</script>

<style scoped src="./proxy-panel.css"></style>
