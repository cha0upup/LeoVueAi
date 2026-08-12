<template>
  <el-dialog
    v-model="managerVisible"
    title="模型能力库"
    width="960px"
    class="ai-model-dialog capability-dialog"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <div class="capability-manager">
      <div class="capability-list-toolbar">
        <div>
          <strong>模型能力目录</strong>
          <p class="muted small">
            未收录模型会按保守默认能力调用；补全能力后可启用工具调用、Reasoning 和更高上下文上限。
          </p>
        </div>
        <el-input
          v-model="searchKeyword"
          placeholder="搜索模型 / 来源 / 备注"
          clearable
        >
          <template #prefix>
            <el-icon><Icon :icon="icons.search" /></el-icon>
          </template>
        </el-input>
        <el-button
          type="primary"
          @click="$emit('create')"
        >
          新增能力
        </el-button>
        <el-button
          :loading="loading"
          @click="$emit('load')"
        >
          刷新
        </el-button>
      </div>
      <el-table
        v-loading="loading"
        :data="items"
        class="capability-table"
        max-height="320"
        empty-text="暂无能力记录"
      >
        <el-table-column
          label="模型"
          prop="modelName"
          min-width="190"
          show-overflow-tooltip
        />
        <el-table-column
          label="来源"
          min-width="110"
        >
          <template #default="{ row }">
            {{ capabilitySourceLabel(row.source) }}
          </template>
        </el-table-column>
        <el-table-column
          label="能力上限"
          min-width="170"
        >
          <template #default="{ row }">
            {{ shortTokens(row.contextWindowTokens) }} / {{ shortTokens(row.maxOutputTokens) }}
          </template>
        </el-table-column>
        <el-table-column
          label="支持能力"
          min-width="180"
        >
          <template #default="{ row }">
            <span class="cap-icons">
              <i v-if="row.supportsTextGeneration">文</i>
              <i v-if="row.supportsReasoning">思</i>
              <i v-if="row.supportsStreaming">流</i>
              <i v-if="row.supportsFunctionCalling">函</i>
              <i v-if="row.supportsStructuredOutput">构</i>
              <i v-if="row.supportsWebSearch">搜</i>
              <i v-if="row.supportsParallelToolCalls">并</i>
            </span>
          </template>
        </el-table-column>
        <el-table-column
          label="操作"
          width="150"
          fixed="right"
        >
          <template #default="{ row }">
            <el-button
              size="small"
              text
              type="primary"
              @click="$emit('edit', row)"
            >
              编辑
            </el-button>
            <el-popconfirm
              :title="`删除 ${row.modelName} 的能力记录？`"
              confirm-button-text="删除"
              cancel-button-text="取消"
              @confirm="$emit('remove', row)"
            >
              <template #reference>
                <el-button
                  size="small"
                  text
                  type="danger"
                >
                  删除
                </el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </el-dialog>

  <el-dialog
    v-model="formVisible"
    :title="editing ? '编辑模型能力' : '新增模型能力'"
    width="680px"
    class="ai-model-dialog capability-form-dialog"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <el-form
      :ref="setFormRef"
      :model="form"
      :rules="rules"
      label-position="top"
    >
      <div class="form-grid two">
        <el-form-item
          label="模型 ID"
          prop="modelName"
        >
          <el-input
            v-model="form.modelName"
            :disabled="Boolean(editing)"
            placeholder="如 deepseek-v4-pro"
            clearable
          />
        </el-form-item>
        <el-form-item label="来源">
          <el-select
            v-model="form.source"
            style="width: 100%"
          >
            <el-option
              label="系统内置"
              value="system"
            />
            <el-option
              label="人工维护"
              value="manual"
            />
            <el-option
              label="官方能力库"
              value="official"
            />
          </el-select>
        </el-form-item>
        <el-form-item
          label="上下文窗口 tokens"
          prop="contextWindowTokens"
        >
          <el-input-number
            v-model="form.contextWindowTokens"
            :min="1"
            :max="2000000"
            :step="1024"
          />
        </el-form-item>
        <el-form-item
          label="最大输出 tokens"
          prop="maxOutputTokens"
        >
          <el-input-number
            v-model="form.maxOutputTokens"
            :min="0"
            :max="500000"
            :step="1024"
          />
        </el-form-item>
      </div>
      <div class="capability-switch-grid">
        <el-checkbox v-model="form.supportsTextGenerationBool">
          文本生成
        </el-checkbox>
        <el-checkbox v-model="form.supportsReasoningBool">
          Reasoning
        </el-checkbox>
        <el-checkbox v-model="form.supportsStreamingBool">
          流式输出
        </el-checkbox>
        <el-checkbox v-model="form.supportsFunctionCallingBool">
          函数调用
        </el-checkbox>
        <el-checkbox v-model="form.supportsStructuredOutputBool">
          结构化输出
        </el-checkbox>
        <el-checkbox v-model="form.supportsWebSearchBool">
          联网搜索
        </el-checkbox>
        <el-checkbox v-model="form.supportsParallelToolCallsBool">
          并行工具
        </el-checkbox>
      </div>
      <el-form-item label="备注">
        <el-input
          v-model="form.remark"
          type="textarea"
          :rows="2"
          placeholder="可选"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="ai-model-dialog__footer">
        <el-button @click="formVisible = false">
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
import { Icon } from '@iconify/vue'
import { reactive } from 'vue'

import { icons } from '@/utils/icons.js'
import { capabilitySourceLabel, shortTokens } from './aiChannelSettingsModel.js'

const managerVisible = defineModel('managerVisible', { type: Boolean, default: false })
const formVisible = defineModel('formVisible', { type: Boolean, default: false })
const searchKeyword = defineModel('searchKeyword', { type: String, default: '' })

const props = defineProps({
  items: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  editing: { type: Object, default: null },
  formState: { type: Object, required: true },
  rules: { type: Object, required: true },
  saveLoading: { type: Boolean, default: false }
})

const form = reactive(props.formState)

const emit = defineEmits([
  'load',
  'create',
  'edit',
  'remove',
  'submit',
  'form-ready'
])

const setFormRef = (instance) => emit('form-ready', instance)
</script>

<style>
.capability-manager {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.capability-list-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.capability-list-toolbar .el-input {
  max-width: 360px;
}

.capability-table {
  width: 100%;
}

.capability-manager .cap-icons {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 5px;
}

.capability-manager .cap-icons i {
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

.form-grid.two {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.form-grid.two .el-input-number {
  width: 100%;
}

.capability-switch-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px 16px;
  margin-bottom: 18px;
}

.capability-manager .muted {
  color: var(--el-text-color-secondary);
}

.capability-manager .muted.small {
  font-size: 12px;
}

.ai-model-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 720px) {
  .capability-dialog,
  .capability-form-dialog {
    width: calc(100vw - 32px) !important;
  }

  .capability-list-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .capability-list-toolbar .el-input {
    max-width: none;
  }

  .capability-switch-grid,
  .form-grid.two {
    grid-template-columns: 1fr;
  }
}
</style>
