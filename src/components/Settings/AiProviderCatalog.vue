<template>
  <div class="access-main-column">
    <StatsStrip :columns="4">
      <div class="metric-card">
        <span class="metric-label">供应商</span>
        <strong class="metric-value">{{ providerListError ? '—' : savedProviders.length }}</strong>
        <small class="metric-hint">{{ providerListError ? '目录读取失败' : `已启用 ${enabledProviderCount} 个` }}</small>
      </div>
      <div class="metric-card">
        <span class="metric-label">已同步模型</span>
        <strong class="metric-value">{{ modelListError ? '—' : rows.length }}</strong>
        <small class="metric-hint">{{ modelListError ? '目录读取失败' : `已启用 ${enabledModelCount} 个` }}</small>
      </div>
      <div class="metric-card">
        <span class="metric-label">能力库模型</span>
        <strong class="metric-value">{{ modelListError ? '—' : recognizedModelCount }}</strong>
        <small class="metric-hint">{{ modelListError ? '模型目录读取失败' : `识别率 ${recognitionRate}%` }}</small>
      </div>
      <div class="metric-card">
        <span class="metric-label">熔断模型</span>
        <strong class="metric-value">{{ circuitSummary.count }}</strong>
        <small
          class="metric-hint"
          aria-live="polite"
        >{{ circuitSummary.hint }}</small>
      </div>
    </StatsStrip>

    <AdminWorkspacePanel title="供应商列表">
      <template #actions>
        <el-button @click="$emit('open-capabilities')">
          <el-icon><Icon :icon="icons.setting" /></el-icon>
          能力库
        </el-button>
        <el-button
          :loading="loading"
          @click="$emit('refresh')"
        >
          <el-icon><Icon :icon="icons.refresh" /></el-icon>
          刷新
        </el-button>
      </template>

      <div class="provider-list-content">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索供应商 / Base URL / 模型名称"
          clearable
          class="ai-model-settings__search"
        >
          <template #prefix>
            <el-icon><Icon :icon="icons.search" /></el-icon>
          </template>
        </el-input>

        <div
          v-loading="loading"
          class="provider-cards"
        >
          <el-alert
            v-if="directoryError"
            title="目录读取异常，请刷新重试"
            :description="directoryError"
            type="warning"
            :closable="false"
            show-icon
          />
          <article
            v-for="{ provider, visibleModels } in filteredProviderRows"
            :key="provider.id"
            class="provider-card-row"
            :class="{ 'is-disabled': provider.enabled === 0 }"
          >
            <div class="provider-card-row__header">
              <div class="provider-avatar">
                {{ providerInitial(provider) }}
              </div>
              <div class="provider-main">
                <div class="provider-name-line">
                  <strong>{{ provider.name }}</strong>
                  <StatusIndicator
                    :status="provider.enabled !== 0 ? 'normal' : 'disabled'"
                    :label="provider.enabled !== 0 ? '已启用' : '已禁用'"
                    compact
                  />
                  <el-tag
                    v-if="provider.apiKeyConfigured"
                    type="primary"
                    size="small"
                    effect="plain"
                  >
                    API Key 已配置
                  </el-tag>
                </div>
                <div class="provider-meta-line">
                  <span>Base URL：{{ provider.baseUrl || '未配置' }}</span>
                  <span>
                    同步模型：{{ modelListError ? '待刷新' : `${provider.models.length} 个` }}
                    <template v-if="visibleModels.length < provider.models.length">
                      （显示 {{ visibleModels.length }} 个匹配模型）
                    </template>
                  </span>
                  <span>同步时间：{{ provider.updatedAt || provider.createdAt || '暂无' }}</span>
                </div>
              </div>
              <div class="provider-actions">
                <el-button
                  size="small"
                  :loading="isProviderTesting(provider)"
                  :disabled="providerTestModelId(provider) == null"
                  @click="$emit('test-provider', provider)"
                >
                  测试连接
                </el-button>
                <el-button
                  size="small"
                  :loading="syncingProviderId === provider.id"
                  :disabled="!provider.id"
                  @click="$emit('sync-provider', provider)"
                >
                  同步模型
                </el-button>
                <el-button
                  size="small"
                  @click="$emit('edit-provider', provider)"
                >
                  编辑
                </el-button>
                <el-popconfirm
                  :title="modelListError ? '确定删除该供应商？其下模型将一并删除。' : `确定删除该供应商？其下 ${provider.models.length} 个模型将一并删除。`"
                  confirm-button-text="删除"
                  cancel-button-text="取消"
                  @confirm="$emit('remove-provider', provider)"
                >
                  <template #reference>
                    <el-button
                      size="small"
                      type="danger"
                    >
                      删除
                    </el-button>
                  </template>
                </el-popconfirm>
              </div>
            </div>

            <div
              v-if="visibleModels.length"
              class="model-table-lite"
            >
              <div class="model-table-lite__head">
                <span>模型名称</span>
                <span>能力状态</span>
                <span>能力上限</span>
                <span>支持能力</span>
                <span>状态</span>
              </div>
              <button
                v-for="model in visibleModels"
                :key="model.id"
                class="model-row-lite"
                :class="{ 'is-selected': selectedModelId === model.id }"
                :aria-pressed="selectedModelId === model.id"
                @click="$emit('select-model', model)"
              >
                <strong>
                  {{ model.model }}
                  <em v-if="model.isActive === 1">默认</em>
                </strong>
                <span>
                  <el-tag
                    v-if="model.capabilityRecognized"
                    size="small"
                    type="success"
                    effect="plain"
                  >已识别</el-tag>
                  <el-tag
                    v-else
                    size="small"
                    type="danger"
                    effect="plain"
                  >未收录</el-tag>
                </span>
                <span>
                  <el-tag
                    v-if="model.capabilityRecognized"
                    size="small"
                    type="primary"
                    effect="plain"
                  >
                    {{ shortTokens(model.capabilityContextWindowTokens) }} 上下文 / {{ shortTokens(model.capabilityMaxOutputTokens) }} 输出
                  </el-tag>
                  <span
                    v-else
                    class="muted"
                  >保守默认</span>
                </span>
                <span class="cap-icons">
                  <i v-if="model.supportsTextGeneration">文</i>
                  <i v-if="model.supportsReasoning">思</i>
                  <i v-if="model.supportsFunctionCalling">函</i>
                  <i v-if="model.supportsStructuredOutput">构</i>
                  <i v-if="model.supportsWebSearch">搜</i>
                  <i v-if="model.supportsParallelToolCalls">并</i>
                </span>
                <span>
                  <el-tag
                    v-if="healthReadState === 'ready' && modelHealthById[model.id]?.circuitOpen"
                    size="small"
                    type="danger"
                    effect="plain"
                  >熔断保护</el-tag>
                  <span v-else><span class="status-dot" />{{ model.enabled !== 0 ? '已启用' : '已禁用' }}</span>
                </span>
              </button>
            </div>
          </article>

          <div
            v-if="!loading && !directoryError && filteredProviderRows.length === 0"
            class="provider-empty-hint"
          >
            {{ hasSearchKeyword ? '未找到匹配的供应商或模型' : '暂无供应商' }}
          </div>
        </div>
      </div>
    </AdminWorkspacePanel>
  </div>
</template>

<script setup>
import { Icon } from '@iconify/vue'
import { computed } from 'vue'

import StatsStrip from '@/components/common/StatsStrip.vue'
import AdminWorkspacePanel from '@/components/Admin/shared/AdminWorkspacePanel.vue'
import StatusIndicator from '@/components/common/StatusIndicator.vue'
import { icons } from '@/utils/icons.js'
import {
  buildProviderRows,
  healthStatusLabel,
  providerInitial,
  providerTestModelId,
  searchProviderRows,
  shortTokens
} from './aiChannelSettingsModel.js'

const searchKeyword = defineModel('searchKeyword', { type: String, default: '' })

const props = defineProps({
  savedProviders: { type: Array, default: () => [] },
  rows: { type: Array, default: () => [] },
  providerListError: { type: String, default: '' },
  modelListError: { type: String, default: '' },
  modelHealthById: { type: Object, default: () => ({}) },
  healthReadState: { type: String, default: 'loading' },
  selectedModelId: { type: [Number, String], default: null },
  loading: { type: Boolean, default: false },
  testingModelId: { type: [Number, String], default: null },
  syncingProviderId: { type: [Number, String], default: null }
})

defineEmits([
  'open-capabilities',
  'refresh',
  'test-provider',
  'sync-provider',
  'edit-provider',
  'remove-provider',
  'select-model'
])

const directoryError = computed(() => [
  props.providerListError && `供应商：${props.providerListError}`,
  props.modelListError && `模型：${props.modelListError}`
].filter(Boolean).join('；'))
const enabledProviderCount = computed(() => props.savedProviders.filter((item) => item.enabled !== 0).length)
const enabledModelCount = computed(() => props.rows.filter((item) => item.enabled !== 0).length)
const recognizedModelCount = computed(() => props.rows.filter((item) => item.capabilityRecognized).length)
const circuitSummary = computed(() => {
  if (props.modelListError) return { count: '—', hint: '模型目录读取失败' }
  if (props.healthReadState !== 'ready') return { count: '—', hint: healthStatusLabel(props.healthReadState) }
  if (!props.rows.length) return { count: '—', hint: '暂无模型' }
  let recorded = 0
  let open = 0
  for (const { id } of props.rows) {
    const health = props.modelHealthById[id]
    if (!health?.status || health.status === 'unknown') continue
    recorded += 1
    if (health.circuitOpen) open += 1
  }
  if (!recorded) return { count: '—', hint: healthStatusLabel('unknown') }
  return { count: open, hint: `已有健康记录 ${recorded}/${props.rows.length}` }
})
const recognitionRate = computed(() => props.rows.length ? Math.round((recognizedModelCount.value / props.rows.length) * 1000) / 10 : 0)
const providerRows = computed(() => buildProviderRows(props.savedProviders, props.rows))
const filteredProviderRows = computed(() => searchProviderRows(providerRows.value, searchKeyword.value))
const hasSearchKeyword = computed(() => searchKeyword.value.trim().length > 0)

const isProviderTesting = (provider) => {
  const modelId = providerTestModelId(provider)
  return modelId != null && props.testingModelId === modelId
}
</script>

<style scoped>
.access-main-column {
  container: ai-catalog / inline-size;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 0;
}

.provider-list-content {
  padding: var(--space-3) var(--space-4) var(--space-4);
}

.ai-model-settings__search {
  width: 390px;
  max-width: 100%;
}

.provider-cards {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: 16px;
  min-height: 88px;
}

.provider-empty-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 88px;
  border: 1px dashed var(--el-border-color);
  border-radius: 8px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  background: var(--el-fill-color-light);
}

.provider-card-row {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color-overlay);
  box-shadow: none;
  overflow: hidden;
}

.provider-card-row.is-disabled { opacity: 0.72; }

.provider-card-row__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
}

.provider-avatar {
  display: inline-flex;
  flex: 0 0 48px;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 8px;
  color: var(--el-color-white);
  font-weight: 700;
  background: var(--el-color-primary);
}

.provider-main {
  flex: 1 1 260px;
  min-width: 0;
}

.provider-name-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.provider-name-line strong {
  color: var(--el-text-color-primary);
  font-size: var(--font-size-section-title);
  overflow-wrap: anywhere;
}

.provider-meta-line {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  overflow-wrap: anywhere;
}

.provider-meta-line span + span::before {
  content: '';
  display: inline-block;
  width: 1px;
  height: 12px;
  margin: 0 14px;
  vertical-align: -1px;
  background: var(--el-border-color);
}

.status-dot::before {
  content: '';
  display: inline-block;
  width: 7px;
  height: 7px;
  margin-right: 5px;
  border-radius: 999px;
  background: var(--el-color-success);
}

.provider-actions {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  margin-left: auto;
  gap: 8px;
}

.provider-actions .el-button + .el-button { margin-left: 0; }

.model-table-lite {
  padding: 0 var(--space-3) var(--space-3);
}

.model-table-lite__head,
.model-row-lite {
  display: grid;
  grid-template-columns: minmax(150px, 1.35fr) 72px minmax(150px, 1fr) minmax(100px, 0.9fr) 72px;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.model-table-lite__head {
  padding: 12px 14px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  background: var(--el-fill-color-light);
}

.model-row-lite {
  width: 100%;
  min-height: 48px;
  padding: var(--space-3);
  border: 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
  color: var(--el-text-color-primary);
  text-align: left;
  background: transparent;
  cursor: pointer;
}

.model-row-lite:hover,
.model-row-lite.is-selected {
  background: color-mix(in srgb, var(--el-color-primary) 10%, var(--el-fill-color-light));
}

.model-row-lite:focus-visible { outline: var(--focus-outline); outline-offset: -2px; }
.model-row-lite > * { min-width: 0; }
.model-row-lite > strong { overflow-wrap: anywhere; }
.model-row-lite :deep(.el-tag) { max-width: 100%; height: auto; min-height: 20px; white-space: normal; }

.model-row-lite strong em {
  margin-left: 6px;
  padding: 2px 6px;
  border-radius: 4px;
  color: var(--el-color-primary-dark-2);
  background: var(--el-color-primary-light-8);
  font-size: 12px;
  font-style: normal;
}

.cap-icons {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 5px;
}

.cap-icons i {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  color: var(--el-color-primary);
  font-size: 12px;
  font-style: normal;
  background: color-mix(in srgb, var(--el-color-primary) 12%, var(--el-bg-color-overlay));
}

.muted { color: var(--el-text-color-secondary); }

@container ai-catalog (max-width: 680px) {
  .provider-avatar { flex-basis: 36px; width: 36px; height: 36px; }
  .provider-main { flex-basis: calc(100% - 48px); }
  .provider-actions { margin-left: 48px; }

  .model-table-lite__head { display: none; }

  .model-row-lite {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--space-2);
  }

  .model-row-lite > strong { grid-column: 1; }
  .model-row-lite > span:nth-child(2) { grid-column: 2; grid-row: 1; }
  .model-row-lite > span:nth-child(3) { grid-column: 1 / -1; }
  .model-row-lite > .cap-icons { grid-column: 1; }
  .model-row-lite > span:last-child { grid-column: 2; white-space: nowrap; }
}

@container ai-catalog (max-width: 420px) {
  .provider-card-row__header { padding: var(--space-3); }
  .provider-actions { margin-left: 0; gap: var(--space-1); }
  .provider-meta-line { display: grid; gap: var(--space-1); font-size: var(--font-size-helper); }
  .provider-meta-line span + span::before { content: none; }
  .provider-name-line { gap: var(--space-1); }
  .model-table-lite { padding-inline: var(--space-1); }
  .model-row-lite { padding: var(--space-2); }
}
</style>
