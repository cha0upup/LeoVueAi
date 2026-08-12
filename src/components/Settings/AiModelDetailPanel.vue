<template>
  <aside class="model-detail-panel">
    <template v-if="model">
      <div class="detail-header">
        <div class="provider-avatar detail">
          {{ providerInitial({ name: model.model }) }}
        </div>
        <div class="detail-title">
          <h4>{{ model.model }}</h4>
          <p>来自 {{ model.providerName || model.name || '供应商' }}</p>
          <el-tag
            v-if="model.enabled !== 0"
            type="success"
            size="small"
          >
            已启用
          </el-tag>
          <el-tag
            v-else
            type="danger"
            size="small"
          >
            已禁用
          </el-tag>
          <el-tag
            v-if="health.circuitOpen"
            type="danger"
            size="small"
          >
            熔断中
          </el-tag>
        </div>
        <div class="detail-actions">
          <el-button
            size="small"
            @click="$emit('edit', model)"
          >
            编辑模型
          </el-button>
          <el-button
            size="small"
            :loading="probingId === model.id"
            @click="$emit('probe', model)"
          >
            真实探测
          </el-button>
          <el-button
            v-if="model.isActive !== 1"
            size="small"
            type="primary"
            plain
            :loading="activatingId === model.id"
            @click="$emit('activate', model)"
          >
            设为默认
          </el-button>
        </div>
      </div>

      <div class="detail-tabs">
        <section class="capability-box">
          <div class="capability-box__title">
            <strong>能力状态</strong>
            <el-tag
              v-if="model.capabilityRecognized"
              type="success"
              size="small"
            >
              已识别
            </el-tag>
            <el-tag
              v-else
              type="danger"
              size="small"
            >
              未收录
            </el-tag>
          </div>
          <p class="muted small">
            来源：{{ capabilitySourceLabel(model.capabilitySource) }}
          </p>
          <p class="muted small">
            模型键：{{ capabilityIdentityLabel(model) }}
          </p>
          <p
            v-if="!model.capabilityRecognized"
            class="warning-copy"
          >
            该模型未收录到能力库，将按保守默认能力调用：支持文本与流式输出，默认关闭工具调用与 Reasoning。
          </p>
        </section>

        <section class="capability-box">
          <div class="capability-box__title">
            <strong>调用健康</strong>
            <el-tag
              :type="healthTagType(health.status)"
              size="small"
            >
              {{ healthStatusLabel(health.status) }}
            </el-tag>
          </div>
          <p
            v-if="health.circuitOpen"
            class="warning-copy"
          >
            已连续发生 {{ health.consecutiveFailures }} 次暂态故障，下一轮请求将优先使用备用模型。
          </p>
          <p
            v-else
            class="muted small"
          >
            连接测试或一次完整回答成功后会自动恢复健康状态。
          </p>
          <p
            v-if="model.fallbackModelName"
            class="muted small"
          >
            备用模型：{{ model.fallbackModelName }}
          </p>
        </section>

        <div class="section-subtitle-row">
          <div>
            <h4 class="section-subtitle">
              当前生效配置
            </h4>
            <p class="muted small">
              {{ effectiveLimitLabel(model) }}
            </p>
          </div>
          <el-button
            size="small"
            text
            type="primary"
            @click="$emit('edit', model)"
          >
            修改
          </el-button>
        </div>
        <div class="limit-grid">
          <div class="limit-card">
            <span>上下文上限</span>
            <strong>{{ formatNumber(model.effectiveContextWindowTokens) }}</strong>
            <small>tokens</small>
          </div>
          <div class="limit-card">
            <span>输出上限</span>
            <strong>{{ formatNumber(model.effectiveMaxOutputTokens) }}</strong>
            <small>tokens</small>
          </div>
        </div>

        <h4 class="section-subtitle">
          能力上限（{{ model.capabilityRecognized ? '能力库收录' : '未收录' }}）
        </h4>
        <div class="limit-grid">
          <div class="limit-card">
            <span>上下文窗口</span>
            <strong>{{ formatNumber(model.capabilityContextWindowTokens) }}</strong>
            <small>tokens</small>
          </div>
          <div class="limit-card">
            <span>最大输出长度</span>
            <strong>{{ formatNumber(model.capabilityMaxOutputTokens) }}</strong>
            <small>tokens</small>
          </div>
        </div>

        <h4 class="section-subtitle">
          支持能力
        </h4>
        <div class="support-grid">
          <div
            v-for="item in supportItems(model)"
            :key="item.label"
            class="support-item"
            :class="{ 'is-off': !item.enabled }"
          >
            <span>{{ item.label }}</span>
            <strong>{{ item.enabled ? '✓' : '—' }}</strong>
          </div>
        </div>
      </div>
    </template>
    <el-empty
      v-else
      description="请选择一个模型查看能力上限"
    />
  </aside>
</template>

<script setup>
import { computed } from 'vue'

import {
  capabilityIdentityLabel,
  capabilitySourceLabel,
  effectiveLimitLabel,
  formatNumber,
  healthStatusLabel,
  healthTagType,
  providerInitial,
  supportItems
} from './aiChannelSettingsModel.js'

const props = defineProps({
  model: { type: Object, default: null },
  modelHealthById: { type: Object, default: () => ({}) },
  probingId: { type: [Number, String], default: null },
  activatingId: { type: [Number, String], default: null }
})

defineEmits(['edit', 'probe', 'activate'])

const health = computed(() => props.modelHealthById[props.model?.id] || {
  status: 'unknown',
  circuitOpen: false,
  consecutiveFailures: 0
})
</script>

<style scoped>
.model-detail-panel {
  position: sticky;
  top: 0;
  align-self: start;
  min-width: 0;
  height: calc(100vh - 64px - 84px);
  min-height: 0;
  overflow-y: auto;
  padding: 18px 16px;
  border-left: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color-overlay);
  box-shadow: none;
  font-size: 13px;
}

.model-detail-panel h4 {
  margin: 0;
  color: var(--el-text-color-primary);
}

.detail-header {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.provider-avatar {
  display: inline-flex;
  flex: 0 0 52px;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 8px;
  color: var(--el-color-white);
  font-weight: 700;
  background: var(--el-color-primary);
}

.detail-header h4 {
  margin-bottom: 3px;
  font-size: 16px;
  line-height: 1.25;
}

.detail-title {
  min-width: 0;
  flex: 1;
}

.detail-title p {
  margin: 0 0 6px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.detail-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  white-space: nowrap;
}

.detail-tabs {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.capability-box {
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color-overlay);
}

.capability-box__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.warning-copy {
  margin: 6px 0 0;
  color: #b45309;
  font-size: 11px;
  line-height: 1.5;
}

.limit-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 7px;
}

.limit-card {
  min-height: 68px;
  padding: 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--app-control-background-soft);
}

.limit-card span,
.limit-card small {
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.limit-card strong {
  display: block;
  margin: 5px 0 2px;
  color: var(--el-text-color-primary);
  font-size: 20px;
  line-height: 1.1;
}

.section-subtitle {
  margin: 12px 0 7px !important;
  font-size: 14px;
}

.section-subtitle-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin-top: 10px;
}

.section-subtitle-row .section-subtitle {
  margin: 0 0 4px !important;
}

.section-subtitle-row p {
  margin: 0;
  line-height: 1.45;
}

.support-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.support-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 38px;
  padding: 7px 9px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color-overlay);
  font-size: 12px;
}

.support-item strong { color: #16a34a; }

.support-item.is-off { color: var(--el-text-color-secondary); }

.support-item.is-off strong { color: #94a3b8; }

.muted { color: var(--el-text-color-secondary); }

.muted.small { font-size: 12px; }

@media (max-width: 720px) {
  .model-detail-panel {
    position: static;
  }

  .limit-grid,
  .support-grid {
    grid-template-columns: 1fr;
  }
}
</style>
