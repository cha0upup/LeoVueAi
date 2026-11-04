<template>
  <el-dialog
    v-model="visible"
    title="编辑模型配置"
    width="760px"
    class="ai-model-dialog model-config-dialog"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <div class="ai-model-dialog__body">
      <div class="model-edit-summary">
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
                :max="parameterRules.contextWindowTokens?.maximum ?? undefined"
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
                :max="parameterRules.maxOutputTokens?.maximum ?? undefined"
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
                  v-if="temperatureConfigurable"
                  v-model="form.temperature"
                  :min="parameterRules.temperature?.minimum ?? 0"
                  :max="parameterRules.temperature?.maximum ?? 2"
                  :step="0.1"
                  :precision="parameterRules.temperature?.precision ?? 2"
                  :value-on-clear="null"
                  placeholder="留空使用厂商默认"
                />
                <el-input
                  v-else
                  :model-value="parameterRules.temperature?.fixedValue != null
                    ? `${parameterRules.temperature.fixedValue}（厂商固定）` : '当前模式不发送此参数'"
                  disabled
                />
                <el-button
                  v-if="!temperatureConfigurable && form.temperature != null"
                  link
                  type="primary"
                  @click="form.temperature = null"
                >
                  清除已配置采样值
                </el-button>
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

        <section
          class="dialog-section request-preview"
          aria-label="实际请求参数预览"
        >
          <div class="dialog-section__title">
            <strong>实际生效参数</strong>
            <span>仅在服务端计算；不调用厂商接口，不包含消息、工具内容或认证信息。</span>
          </div>
          <p
            v-if="previewLoading"
            role="status"
            class="muted small"
          >
            正在更新参数预览…
          </p>
          <el-alert
            v-if="previewError"
            type="error"
            :title="previewError"
            :closable="false"
          />
          <ul
            v-if="requestPreview && !requestPreview.valid"
            class="request-preview-errors"
            role="alert"
          >
            <li
              v-for="error in requestPreview.errors"
              :key="error.field"
            >
              {{ parameterLabel(error.field) }}：{{ error.message }}
            </li>
          </ul>
          <template v-if="requestPreview?.valid">
            <div class="request-parameter-scroll">
              <table class="request-parameter-table">
                <thead><tr><th>参数</th><th>配置值</th><th>生效值</th><th>处理方式</th></tr></thead>
                <tbody>
                  <tr
                    v-for="item in requestPreview.parameters"
                    :key="item.field"
                    :title="item.reason"
                  >
                    <td>{{ parameterLabel(item.field) }}</td>
                    <td>{{ parameterValue(item.configuredValue) }}</td>
                    <td>{{ parameterValue(item.effectiveValue) }}</td>
                    <td>{{ parameterStatus(item.status) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <details>
              <summary>查看转换后的模型参数（不含消息与工具定义）</summary>
              <pre class="request-parameter-json">{{ JSON.stringify(requestPreview.requestParameters, null, 2) }}</pre>
            </details>
            <p class="muted small">
              参数规则来源：{{ requestPreview.contract.source }}
              <span v-if="requestPreview.contract.checkedAt"> · 核对于 {{ requestPreview.contract.checkedAt }}</span>
            </p>
          </template>
          <p
            v-else-if="!previewLoading && !previewError && !requestPreview"
            class="muted small"
          >
            选择供应商并填写模型 ID 后自动预览。
          </p>
        </section>
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
  formState: { type: Object, required: true },
  rules: { type: Object, required: true },
  savedProviders: { type: Array, default: () => [] },
  fallbackCandidates: { type: Array, default: () => [] },
  reasoningModeOptions: { type: Array, default: () => [] },
  reasoningOptions: { type: Array, default: () => [] },
  temperatureConfigurable: { type: Boolean, default: true },
  parameterRules: { type: Object, default: () => ({}) },
  requestPreview: { type: Object, default: null },
  previewLoading: { type: Boolean, default: false },
  previewError: { type: String, default: '' },
  inheritedEndpointLabel: { type: String, default: '' },
  modelLimitHint: { type: String, default: '' },
  reasoningCapabilityHint: { type: String, default: '' },
  saveLoading: { type: Boolean, default: false }
})

const form = reactive(props.formState)
const providerName = computed(() => props.savedProviders.find((provider) => provider.id === form.providerId)?.name || '')

const parameterLabel = field => ({ thinkingEnabled: '思考模式', reasoningEffort: '思考等级',
  temperature: 'Temperature', maxOutputTokens: '输出上限', contextWindowTokens: '本地上下文预算', protocol: '接口协议' }[field] || field)
const parameterStatus = status => ({ sent: '发送', default: '厂商默认', omitted: '省略', clamped: '按能力裁剪', local: '仅本地生效' }[status] || status)
const parameterValue = value => value == null ? '未设置' : value === true ? '开启' : value === false ? '关闭' : String(value)

const fallbackOptionLabel = (candidate) => `${candidate.name || candidate.model} · ${candidate.model}`

const emit = defineEmits(['submit', 'form-ready'])
const setFormRef = (instance) => emit('form-ready', instance)
</script>

<style>
.request-parameter-scroll { overflow-x: auto; }
.request-parameter-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.request-parameter-table th, .request-parameter-table td { padding: 8px; text-align: left; border-bottom: 1px solid var(--el-border-color-lighter); }
.request-parameter-json { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 12px; }
.request-preview-errors { color: var(--el-color-danger); padding-left: 20px; }
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

.model-config-dialog .model-edit-summary div {
  min-width: 0;
}

.model-config-dialog .model-edit-summary span,
.model-config-dialog .limit-config-card span {
  display: block;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.4;
}

.model-config-dialog .model-edit-summary strong {
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
