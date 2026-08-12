<template>
  <el-dialog
    v-model="visible"
    :title="editing ? '编辑模型配置' : '新增模型配置'"
    width="760px"
    class="ai-model-dialog model-config-dialog"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <div class="ai-model-dialog__body">
      <div
        v-if="editing"
        class="model-edit-summary"
      >
        <div>
          <span>所属供应商</span>
          <strong>{{ form.providerName || providerName || '未选择' }}</strong>
        </div>
        <div>
          <span>接口地址</span>
          <strong>{{ inheritedEndpointLabel }}</strong>
        </div>
      </div>

      <el-form
        :ref="setFormRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent
      >
        <section class="dialog-section">
          <div class="dialog-section__title">
            <strong>基础信息</strong>
            <span>模型归属和展示名称</span>
          </div>
          <div class="form-grid two">
            <el-form-item
              label="模型名称"
              prop="name"
            >
              <el-input
                v-model="form.name"
                placeholder="如 deepseek-v4-pro"
                clearable
              />
            </el-form-item>

            <el-form-item
              label="模型 ID"
              prop="model"
            >
              <el-input
                v-model="form.model"
                placeholder="gpt-4o / deepseek-reasoner / qwen-max"
                clearable
              />
            </el-form-item>
          </div>

          <el-form-item
            v-if="!editing"
            label="供应商"
            prop="providerId"
          >
            <el-select
              v-model="form.providerId"
              filterable
              placeholder="选择已保存供应商"
              style="width: 100%"
              @change="$emit('apply-provider')"
            >
              <el-option
                v-for="provider in savedProviders"
                :key="provider.id"
                :label="provider.name"
                :value="provider.id"
                :disabled="provider.enabled === 0"
              >
                <span>{{ provider.name }}</span>
                <span class="provider-option-meta">{{ provider.baseUrl }}</span>
              </el-option>
            </el-select>
          </el-form-item>

          <div
            v-if="!editing"
            class="provider-inherit-box"
          >
            <span>接口地址继承自供应商</span>
            <strong>{{ inheritedEndpointLabel }}</strong>
          </div>
        </section>

        <section class="dialog-section">
          <div class="dialog-section__title">
            <strong>调用上限</strong>
            <span>{{ modelLimitHint }}</span>
          </div>
          <div class="limit-config-grid">
            <div class="limit-config-card">
              <div>
                <span>上下文窗口 tokens</span>
                <small>留空使用模型能力上限</small>
              </div>
              <el-input-number
                v-model="form.contextWindowTokens"
                :min="1"
                :max="2000000"
                :step="1024"
                :value-on-clear="null"
                placeholder="留空"
              />
            </div>
            <div class="limit-config-card">
              <div>
                <span>最大输出 tokens</span>
                <small>留空使用模型能力上限</small>
              </div>
              <el-input-number
                v-model="form.maxOutputTokens"
                :min="1"
                :max="500000"
                :step="1024"
                :value-on-clear="null"
                placeholder="留空"
              />
            </div>
          </div>
        </section>

        <section class="dialog-section">
          <div class="dialog-section__title">
            <strong>运行状态</strong>
            <span>控制模型是否可用、默认模型和故障备用链</span>
          </div>
          <div class="model-switch-row">
            <el-checkbox v-model="form.enabledBool">
              启用该模型
            </el-checkbox>
            <el-checkbox v-model="form.isActiveBool">
              设为系统默认模型
            </el-checkbox>
          </div>
          <el-form-item
            label="故障备用模型"
            class="fallback-model-item"
          >
            <el-select
              v-model="form.fallbackModelId"
              clearable
              placeholder="不配置自动降级"
              style="width: 100%"
            >
              <el-option
                v-for="candidate in fallbackCandidates"
                :key="candidate.id"
                :value="candidate.id"
                :label="fallbackOptionLabel(candidate)"
              />
            </el-select>
            <div class="muted small">
              连续发生限流、超时、网络等暂态故障后，只在下一轮新请求切换；不会重试已开始执行工具的请求。
            </div>
          </el-form-item>
        </section>

        <el-collapse class="advanced-options">
          <el-collapse-item
            title="高级参数（通常无需修改）"
            name="advanced"
          >
            <div class="form-grid two">
              <el-form-item label="Reasoning 模式">
                <el-radio-group v-model="form.thinkingEnabled">
                  <el-radio-button
                    v-for="option in reasoningModeOptions"
                    :key="option.label"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </el-radio-button>
                </el-radio-group>
                <div class="muted small">
                  {{ reasoningCapabilityHint }}
                </div>
              </el-form-item>
              <el-form-item label="思考等级">
                <el-segmented
                  v-model="form.reasoningEffort"
                  :options="reasoningOptions"
                />
                <div class="muted small">
                  建议默认自动；复杂分析任务可在会话中临时切换。
                </div>
              </el-form-item>
              <el-form-item label="Temperature">
                <el-input-number
                  v-model="form.temperature"
                  :min="0"
                  :max="2"
                  :step="0.1"
                  :precision="1"
                  :value-on-clear="null"
                  placeholder="留空使用默认"
                />
              </el-form-item>
            </div>
            <el-form-item label="备注">
              <el-input
                v-model="form.remark"
                type="textarea"
                :rows="2"
                placeholder="可选"
              />
            </el-form-item>
          </el-collapse-item>
        </el-collapse>
      </el-form>
    </div>

    <template #footer>
      <div class="ai-model-dialog__footer">
        <el-button @click="visible = false">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="saveLoading"
          @click="$emit('submit')"
        >
          保存
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, reactive } from 'vue'

const visible = defineModel({ type: Boolean, default: false })

const props = defineProps({
  editing: { type: Object, default: null },
  formState: { type: Object, required: true },
  rules: { type: Object, required: true },
  savedProviders: { type: Array, default: () => [] },
  fallbackCandidates: { type: Array, default: () => [] },
  reasoningModeOptions: { type: Array, default: () => [] },
  reasoningOptions: { type: Array, default: () => [] },
  inheritedEndpointLabel: { type: String, default: '' },
  modelLimitHint: { type: String, default: '' },
  reasoningCapabilityHint: { type: String, default: '' },
  saveLoading: { type: Boolean, default: false }
})

const form = reactive(props.formState)
const providerName = computed(() => props.savedProviders.find((provider) => provider.id === form.providerId)?.name || '')

const fallbackOptionLabel = (candidate) => `${candidate.name || candidate.model} · ${candidate.model}`

const emit = defineEmits(['apply-provider', 'submit', 'form-ready'])
const setFormRef = (instance) => emit('form-ready', instance)
</script>

<style>
.model-config-dialog .ai-model-dialog__body {
  max-height: min(680px, 68vh);
  overflow-y: auto;
  padding-right: 4px;
}

.model-config-dialog .model-edit-summary {
  display: grid;
  grid-template-columns: minmax(150px, 0.7fr) minmax(0, 1.3fr);
  gap: 10px;
  margin-bottom: 16px;
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-light);
}

.model-config-dialog .model-edit-summary div,
.model-config-dialog .provider-inherit-box {
  min-width: 0;
}

.model-config-dialog .model-edit-summary span,
.model-config-dialog .provider-inherit-box span,
.model-config-dialog .limit-config-card span {
  display: block;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.4;
}

.model-config-dialog .model-edit-summary strong,
.model-config-dialog .provider-inherit-box strong {
  display: block;
  margin-top: 4px;
  overflow: hidden;
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 650;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-config-dialog .dialog-section {
  margin-bottom: 18px;
}

.model-config-dialog .dialog-section__title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.model-config-dialog .dialog-section__title strong {
  color: var(--el-text-color-primary);
  font-size: 14px;
}

.model-config-dialog .dialog-section__title span,
.model-config-dialog .muted {
  color: var(--el-text-color-secondary);
}

.model-config-dialog .dialog-section__title span,
.model-config-dialog .muted.small {
  font-size: 12px;
}

.model-config-dialog .form-grid.two,
.model-config-dialog .limit-config-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.model-config-dialog .provider-inherit-box {
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color-overlay);
}

.model-config-dialog .limit-config-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 104px;
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color-overlay);
}

.model-config-dialog .limit-config-card small {
  display: block;
  margin-top: 3px;
  color: var(--el-text-color-placeholder);
  font-size: 11px;
}

.model-config-dialog .limit-config-card .el-input-number {
  width: 100%;
}

.model-config-dialog .model-switch-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 22px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color-overlay);
}

.model-config-dialog .advanced-options {
  margin-bottom: 16px;
}

.model-config-dialog .provider-option-meta {
  float: right;
  max-width: 320px;
  overflow: hidden;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-config-dialog .ai-model-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 720px) {
  .model-config-dialog {
    width: calc(100vw - 32px) !important;
  }

  .model-config-dialog .ai-model-dialog__body {
    max-height: 70vh;
  }

  .model-config-dialog .model-edit-summary,
  .model-config-dialog .form-grid.two,
  .model-config-dialog .limit-config-grid {
    grid-template-columns: 1fr;
  }
}
</style>
