<template>
  <el-dialog
    v-model="visible"
    :title="editing ? '编辑供应商' : '新增供应商'"
    width="840px"
    top="4vh"
    class="ai-model-dialog provider-dialog"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <div class="ai-model-dialog__body provider-dialog__body">
      <el-form
        :ref="setFormRef"
        :model="form"
        :rules="rules"
        label-position="top"
        class="provider-form"
      >
        <section
          v-if="!editing"
          class="provider-preset-section"
        >
          <div class="provider-section-heading">
            <div>
              <strong>选择服务商</strong>
              <span>选择后会自动填入默认接口协议和路径，也可以继续手动调整。</span>
            </div>
          </div>
          <div class="provider-grid">
            <button
              v-for="provider in providers"
              :key="provider.key"
              type="button"
              class="provider-card"
              :class="{ 'is-selected': selectedProviderKey === provider.key }"
              @click="$emit('select-preset', provider)"
            >
              {{ provider.label }}
            </button>
          </div>
        </section>

        <section class="provider-form-section">
          <div class="provider-section-heading">
            <div>
              <strong>连接配置</strong>
              <span>保存后模型调用会继承这里的地址、密钥和请求头。</span>
            </div>
            <el-checkbox v-model="form.enabledBool">
              启用供应商
            </el-checkbox>
          </div>

          <div class="form-grid two provider-form-grid">
            <el-form-item
              label="供应商名称"
              prop="name"
            >
              <el-input
                v-model="form.name"
                placeholder="如 DeepSeek / OpenAI / 企业网关"
                clearable
              />
            </el-form-item>
            <el-form-item
              label="API Key"
              :prop="editing ? undefined : 'apiKey'"
            >
              <el-input
                v-model="form.apiKey"
                type="password"
                :placeholder="editing ? '留空表示不修改' : 'sk-...'"
                show-password
                clearable
              />
            </el-form-item>
          </div>

          <el-form-item
            label="接口地址"
            prop="baseUrl"
            class="provider-endpoint-item"
          >
            <div class="endpoint-group">
              <div class="endpoint-toolbar">
                <span>协议类型</span>
                <el-segmented
                  v-model="form.protocol"
                  :options="protocolOptions"
                  @change="form.completionsPath = defaultPathForProtocol(form.protocol)"
                />
              </div>
              <div class="endpoint-row">
                <el-input
                  v-model="form.baseUrl"
                  class="endpoint-base-input"
                  placeholder="https://api.openai.com/v1"
                  clearable
                >
                  <template #prepend>
                    Base URL
                  </template>
                </el-input>
                <el-input
                  v-model="form.completionsPath"
                  class="endpoint-path-input"
                  :placeholder="defaultPathForProtocol(form.protocol)"
                  clearable
                >
                  <template #prepend>
                    请求路径
                  </template>
                </el-input>
                <el-button
                  plain
                  @click="form.completionsPath = defaultPathForProtocol(form.protocol)"
                >
                  默认
                </el-button>
              </div>
            </div>
          </el-form-item>

          <div class="form-grid two provider-form-grid">
            <el-form-item label="自定义请求头 JSON">
              <el-input
                v-model="form.headersJson"
                type="textarea"
                :rows="3"
                :placeholder="headersPlaceholder"
                @input="headersTouched = true"
              />
            </el-form-item>
            <el-form-item label="备注">
              <el-input
                v-model="form.remark"
                type="textarea"
                :rows="3"
                placeholder="可选"
              />
            </el-form-item>
          </div>
        </section>
      </el-form>

      <section
        v-if="!editing"
        class="provider-model-section"
      >
        <div class="provider-model-section__header">
          <div>
            <strong>导入模型</strong>
            <div class="muted small">
              未收录模型也可接入；系统会按保守默认能力调用，后续可在能力库中补全。
            </div>
          </div>
          <div class="provider-model-section__actions">
            <el-button
              :loading="fetchingModels"
              :disabled="!form.baseUrl || !form.apiKey"
              @click="$emit('fetch-models')"
            >
              获取模型
            </el-button>
            <el-button @click="$emit('add-model')">
              手动添加
            </el-button>
          </div>
        </div>
        <el-table
          v-if="form.models.length"
          :data="form.models"
          class="import-model-table"
          max-height="300"
        >
          <el-table-column
            width="56"
            align="center"
          >
            <template #default="{ row }">
              <el-checkbox v-model="row.checked" />
            </template>
          </el-table-column>
          <el-table-column
            label="模型 ID"
            min-width="220"
          >
            <template #default="{ row }">
              <el-input
                v-model="row.model"
                size="small"
                placeholder="model-id"
              />
            </template>
          </el-table-column>
          <el-table-column
            label="展示名"
            min-width="220"
          >
            <template #default="{ row }">
              <el-input
                v-model="row.name"
                size="small"
                placeholder="默认同模型 ID"
              />
            </template>
          </el-table-column>
          <el-table-column
            label="默认"
            width="80"
            align="center"
          >
            <template #default="{ $index }">
              <el-radio
                :model-value="defaultModelIndex"
                :label="$index"
                @change="defaultModelIndex = $index"
              />
            </template>
          </el-table-column>
        </el-table>
        <el-empty
          v-else
          description="尚未获取模型；点击获取模型或手动添加模型 ID"
        />
      </section>
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
import { reactive } from 'vue'

import { defaultPathForProtocol } from './aiChannelSettingsModel.js'

const visible = defineModel({ type: Boolean, default: false })
const selectedProviderKey = defineModel('selectedProviderKey', { type: String, default: '' })
const headersTouched = defineModel('headersTouched', { type: Boolean, default: false })
const defaultModelIndex = defineModel('defaultModelIndex', { type: Number, default: 0 })

const props = defineProps({
  editing: { type: Object, default: null },
  formState: { type: Object, required: true },
  rules: { type: Object, required: true },
  providers: { type: Array, default: () => [] },
  protocolOptions: { type: Array, default: () => [] },
  headersPlaceholder: { type: String, default: '' },
  fetchingModels: { type: Boolean, default: false },
  saveLoading: { type: Boolean, default: false }
})

const form = reactive(props.formState)

const emit = defineEmits([
  'select-preset',
  'fetch-models',
  'add-model',
  'submit',
  'form-ready'
])

const setFormRef = (instance) => emit('form-ready', instance)
</script>

<style>
.provider-dialog {
  max-height: calc(100vh - 48px);
}

.provider-dialog .el-dialog__body {
  overflow: hidden;
}

.provider-dialog .ai-model-dialog__body {
  max-height: min(680px, calc(92vh - 220px));
  overflow-y: auto;
  padding-right: 6px;
}

.provider-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.provider-dialog .provider-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.provider-dialog .provider-preset-section,
.provider-dialog .provider-form-section,
.provider-dialog .provider-model-section {
  padding: 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color-overlay);
}

.provider-dialog .provider-section-heading,
.provider-dialog .provider-model-section__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.provider-dialog .provider-section-heading strong,
.provider-dialog .provider-model-section__header strong {
  display: block;
  color: var(--el-text-color-primary);
  font-size: 14px;
  line-height: 1.4;
}

.provider-dialog .provider-section-heading span {
  display: block;
  margin-top: 2px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.45;
}

.provider-dialog .provider-section-heading .el-checkbox {
  flex: 0 0 auto;
  height: 22px;
  margin-top: 1px;
  white-space: nowrap;
}

.provider-dialog .form-grid.two {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.provider-dialog .provider-form-grid {
  margin-bottom: 2px;
}

.provider-dialog .provider-form .el-form-item {
  margin-bottom: 12px;
}

.provider-dialog .provider-form .el-form-item:last-child,
.provider-dialog .provider-form-grid .el-form-item {
  margin-bottom: 0;
}

.provider-dialog .provider-endpoint-item {
  margin-top: 4px;
}

.provider-dialog .endpoint-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.provider-dialog .endpoint-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 32px;
}

.provider-dialog .endpoint-toolbar span,
.provider-dialog .muted {
  color: var(--el-text-color-secondary);
}

.provider-dialog .endpoint-toolbar span,
.provider-dialog .muted.small {
  font-size: 12px;
}

.provider-dialog .endpoint-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.provider-dialog .endpoint-base-input {
  flex: 1;
  min-width: 0;
}

.provider-dialog .endpoint-path-input {
  flex: 0 0 280px;
  min-width: 0;
}

.provider-dialog .provider-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.provider-dialog .provider-card {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 38px;
  padding: 6px 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  color: var(--el-text-color-regular);
  font-family: inherit;
  font-size: 13px;
  line-height: 1.2;
  cursor: pointer;
  transition: all 0.15s;
  background: var(--el-fill-color-blank);
  user-select: none;
  text-align: center;
  white-space: normal;
  overflow-wrap: anywhere;
}

.provider-dialog .provider-card:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}

.provider-dialog .provider-card.is-selected {
  border-color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 10%, var(--el-bg-color-overlay));
  color: var(--el-color-primary);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--el-color-primary) 24%, transparent);
  font-weight: 650;
}

.provider-dialog .provider-model-section__actions {
  display: flex;
  flex: 0 0 auto;
  gap: 8px;
}

.provider-dialog .import-model-table {
  width: 100%;
  margin-top: 8px;
}

.provider-dialog .ai-model-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 720px) {
  .provider-dialog {
    width: calc(100vw - 32px) !important;
  }

  .provider-dialog .ai-model-dialog__body {
    max-height: calc(92vh - 200px);
  }

  .provider-dialog .form-grid.two {
    grid-template-columns: 1fr;
  }

  .provider-dialog .provider-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .provider-dialog .provider-section-heading,
  .provider-dialog .endpoint-toolbar,
  .provider-dialog .provider-model-section__header {
    align-items: flex-start;
    flex-direction: column;
  }

  .provider-dialog .endpoint-row {
    align-items: stretch;
    flex-direction: column;
  }

  .provider-dialog .provider-model-section__actions {
    width: 100%;
  }

  .provider-dialog .endpoint-path-input {
    flex-basis: auto;
  }
}
</style>
