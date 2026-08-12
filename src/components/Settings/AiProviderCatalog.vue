<template>
  <div class="access-main-column">
    <AdminStatsGrid :columns="4">
      <div class="metric-card access-stat">
        <span class="metric-label">供应商</span>
        <strong>{{ savedProviders.length }}</strong>
        <small class="metric-label">已启用 {{ enabledProviderCount }} 个</small>
        <i class="metric-icon"><el-icon><Icon :icon="icons.server" /></el-icon></i>
      </div>
      <div class="metric-card access-stat">
        <span class="metric-label">已同步模型</span>
        <strong>{{ rows.length }}</strong>
        <small class="metric-label">已启用 {{ enabledModelCount }} 个</small>
        <i class="metric-icon is-green"><el-icon><Icon :icon="icons.box" /></el-icon></i>
      </div>
      <div class="metric-card access-stat">
        <span class="metric-label">能力库模型</span>
        <strong>{{ recognizedModelCount }}</strong>
        <small class="metric-label">识别率 {{ recognitionRate }}%</small>
        <i class="metric-icon is-blue"><el-icon><Icon :icon="icons.success" /></el-icon></i>
      </div>
      <div class="metric-card access-stat">
        <span class="metric-label">熔断保护</span>
        <strong>{{ openCircuitModelCount }}</strong>
        <small class="metric-label">{{ openCircuitModelCount ? '已切换备用链' : '全部模型可调度' }}</small>
        <i class="metric-icon is-orange"><el-icon><Icon :icon="icons.warning" /></el-icon></i>
      </div>
    </AdminStatsGrid>

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
          <article
            v-for="provider in filteredProviderRows"
            :key="providerRowKey(provider)"
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
                  <span
                    v-if="provider.enabled !== 0 && provider.apiKeyConfigured"
                    class="connection-dot"
                  >连接正常</span>
                  <el-tag
                    v-if="provider.apiKeyConfigured"
                    type="primary"
                    size="small"
                    effect="plain"
                  >
                    API Key 已验证
                  </el-tag>
                </div>
                <div class="provider-meta-line">
                  <span>Base URL：{{ provider.baseUrl || '未配置' }}</span>
                  <span>同步模型：{{ provider.models.length }} 个</span>
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
                  :title="`确定删除该供应商？其下 ${provider.models.length} 个模型将一并删除。`"
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
              v-if="provider.models.length"
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
                v-for="model in provider.models"
                :key="model.id"
                class="model-row-lite"
                :class="{ 'is-selected': selectedModelId === model.id }"
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
                    v-if="modelHealth(model).circuitOpen"
                    size="small"
                    type="danger"
                    effect="plain"
                  >熔断中</el-tag>
                  <span v-else><span class="status-dot" />{{ model.enabled !== 0 ? '已启用' : '已禁用' }}</span>
                </span>
              </button>
            </div>
          </article>

          <div
            v-if="filteredProviderRows.length === 0"
            class="provider-empty-hint"
          >
            {{ hasSearchKeyword ? '没有匹配的供应商' : '暂无供应商' }}
          </div>
        </div>

        <button
          class="add-provider-strip"
          type="button"
          @click="$emit('create-provider')"
        >
          <el-icon><Icon :icon="icons.add" /></el-icon>
          新增供应商
        </button>
      </div>
    </AdminWorkspacePanel>
  </div>
</template>

<script setup>
import { Icon } from '@iconify/vue'
import { computed } from 'vue'

import AdminStatsGrid from '@/components/Admin/shared/AdminStatsGrid.vue'
import AdminWorkspacePanel from '@/components/Admin/shared/AdminWorkspacePanel.vue'
import StatusIndicator from '@/components/common/StatusIndicator.vue'
import { icons } from '@/utils/icons.js'
import {
  buildProviderRows,
  filterProviderRows,
  providerInitial,
  providerRowKey,
  providerTestModelId,
  shortTokens
} from './aiChannelSettingsModel.js'

const searchKeyword = defineModel('searchKeyword', { type: String, default: '' })

const props = defineProps({
  savedProviders: { type: Array, default: () => [] },
  rows: { type: Array, default: () => [] },
  modelHealthById: { type: Object, default: () => ({}) },
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
  'select-model',
  'create-provider'
])

const enabledProviderCount = computed(() => props.savedProviders.filter((item) => item.enabled !== 0).length)
const enabledModelCount = computed(() => props.rows.filter((item) => item.enabled !== 0).length)
const recognizedModelCount = computed(() => props.rows.filter((item) => item.capabilityRecognized).length)
const openCircuitModelCount = computed(() => Object.values(props.modelHealthById).filter((item) => item?.circuitOpen).length)
const recognitionRate = computed(() => props.rows.length ? Math.round((recognizedModelCount.value / props.rows.length) * 1000) / 10 : 0)
const providerRows = computed(() => buildProviderRows(props.savedProviders, props.rows))
const filteredProviderRows = computed(() => filterProviderRows(providerRows.value, searchKeyword.value))
const hasSearchKeyword = computed(() => searchKeyword.value.trim().length > 0)

const modelHealth = (model) => props.modelHealthById[model?.id] || { circuitOpen: false }
const isProviderTesting = (provider) => {
  const modelId = providerTestModelId(provider)
  return modelId != null && props.testingModelId === modelId
}
</script>

<style scoped>
.access-main-column {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 0;
  padding-bottom: 34px;
}

.access-stat {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 42px;
  grid-template-areas:
    'label icon'
    'value icon'
    'meta icon';
  align-items: center;
  column-gap: 14px;
  min-height: 96px;
  padding: var(--space-4);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color-overlay);
  box-shadow: none;
}

.access-stat span,
.access-stat small {
  display: block;
  min-width: 0;
  color: var(--el-text-color-secondary);
}

.access-stat > span { grid-area: label; }
.access-stat > small { grid-area: meta; }

.access-stat strong {
  grid-area: value;
  display: block;
  min-width: 0;
  margin: 10px 0 8px;
  color: var(--el-text-color-primary);
  font-size: 22px;
  line-height: 1;
  white-space: nowrap;
}

.access-stat i {
  grid-area: icon;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: var(--radius-control);
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 12%, var(--el-bg-color-overlay));
  font-style: normal;
}

.access-stat i.is-green {
  color: var(--el-color-success);
  background: color-mix(in srgb, var(--el-color-success) 14%, var(--el-bg-color-overlay));
}

.access-stat i.is-blue {
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 12%, var(--el-bg-color-overlay));
}

.access-stat i.is-orange {
  color: var(--el-color-warning);
  background: color-mix(in srgb, var(--el-color-warning) 14%, var(--el-bg-color-overlay));
}

.provider-list-content {
  padding: 16px 18px 18px;
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
  flex: 1;
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
}

.provider-meta-line {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
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

.connection-dot {
  color: #16a34a;
  font-size: 12px;
}

.connection-dot::before,
.status-dot::before {
  content: '';
  display: inline-block;
  width: 7px;
  height: 7px;
  margin-right: 5px;
  border-radius: 999px;
  background: #16a34a;
}

.provider-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 8px;
}

.model-table-lite {
  padding: 0 22px 18px;
  overflow-x: auto;
}

.model-table-lite__head,
.model-row-lite {
  display: grid;
  grid-template-columns: minmax(170px, 1.35fr) 88px minmax(150px, 1fr) minmax(130px, 0.9fr) 82px;
  gap: 12px;
  align-items: center;
  min-width: 640px;
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

.add-provider-strip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 54px;
  margin-top: 18px;
  border: 1px dashed var(--el-color-primary-light-7);
  border-radius: 8px;
  color: var(--el-color-primary);
  font-weight: 650;
  background: var(--el-bg-color-overlay);
  cursor: pointer;
}

.add-provider-strip:hover {
  border-color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 10%, var(--el-fill-color-light));
}

@media (max-width: 720px) {
  .provider-card-row__header,
  .provider-actions {
    flex-direction: column;
  }

  .model-table-lite {
    padding-left: 20px;
  }

  .model-table-lite__head,
  .model-row-lite {
    min-width: 720px;
  }
}
</style>
