<template>
  <section class="editor-aside">
    <el-form
      ref="innerFormRef"
      :model="validationModel"
      :rules="rules"
      label-position="top"
      size="small"
      class="editor-form"
    >
      <div class="form-grid">
        <el-form-item
          label="伪装名称"
          prop="disguiseName"
        >
          <el-input
            v-model="disguiseName"
            placeholder="例如：json_wrap"
            maxlength="64"
            clearable
          />
        </el-form-item>

        <el-form-item label="版本号">
          <el-input
            v-model="version"
            placeholder="默认 1.0.0"
            maxlength="32"
            clearable
          />
        </el-form-item>

        <el-form-item
          label="Disguise ID"
          class="span-full"
        >
          <el-input
            v-model="disguiseId"
            :placeholder="mode === 'add' ? '可选，留空自动生成' : ''"
            :disabled="mode === 'edit'"
            clearable
          />
          <div class="field-tip">
            <template v-if="mode === 'add'">
              当前预览：<code>{{ autoIdPreview }}</code>
            </template>
            <template v-else>
              编辑模式下以当前 ID 为主键更新。
            </template>
          </div>
        </el-form-item>

        <el-form-item
          label="支持运行时"
          class="span-full"
        >
          <el-checkbox-group v-model="supportedRuntimes">
            <el-checkbox
              value="java"
              disabled
            >
              Java
            </el-checkbox>
            <el-checkbox value="php">
              PHP
            </el-checkbox>
          </el-checkbox-group>
          <div class="field-tip">
            PHP 伪装使用 protocol v2，并同时保留平台侧 Java 编解码实现。
          </div>
        </el-form-item>

        <el-form-item class="span-full">
          <template #label>
            <span class="label-with-action">
              <span>Headers (JSON 字符串)</span>
              <el-button
                size="small"
                plain
                text
                @click="emit('insert-header-example')"
              >
                <el-icon><Icon :icon="icons.copyDocument" /></el-icon>
                示例
              </el-button>
            </span>
          </template>
          <el-input
            v-model="headersText"
            type="textarea"
            :autosize="{ minRows: 4, maxRows: 12 }"
            resize="none"
            placeholder="{&quot;ContentType&quot;:&quot;text/plain;charset=utf-8&quot;}"
          />
          <div
            class="field-tip"
            :class="`headers-status is-${headersStatus.state}`"
          >
            <span class="status-dot" />
            <span>{{ headersStatus.message }}</span>
          </div>
        </el-form-item>

        <el-form-item
          label="描述"
          class="span-full"
        >
          <el-input
            v-model="description"
            type="textarea"
            :autosize="{ minRows: 4, maxRows: 12 }"
            resize="none"
          />
        </el-form-item>

        <el-form-item
          label="备注"
          class="span-full"
        >
          <el-input
            v-model="remark"
            type="textarea"
            :autosize="{ minRows: 4, maxRows: 12 }"
            resize="none"
          />
        </el-form-item>
      </div>
    </el-form>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { icons } from '@/utils/icons.js'

defineProps({
  mode: { type: String, default: 'add' },
  autoIdPreview: { type: String, default: '' },
  headersStatus: {
    type: Object,
    default: () => ({ state: 'empty', message: '未填写' })
  }
})
const emit = defineEmits(['insert-header-example'])
const disguiseId = defineModel('disguiseId', { type: String, default: '' })
const disguiseName = defineModel('disguiseName', { type: String, default: '' })
const version = defineModel('version', { type: String, default: '' })
const supportedRuntimes = defineModel('supportedRuntimes', { type: Array, default: () => ['java'] })
const headersText = defineModel('headersText', { type: String, default: '' })
const description = defineModel('description', { type: String, default: '' })
const remark = defineModel('remark', { type: String, default: '' })
const innerFormRef = ref(null)
const validationModel = computed(() => ({ disguiseName: disguiseName.value }))
const rules = {
  disguiseName: [{ required: true, message: '伪装名称不能为空', trigger: 'blur' }]
}

defineExpose({
  validate: (...args) => innerFormRef.value?.validate(...args),
  clearValidate: (...args) => innerFormRef.value?.clearValidate(...args)
})
</script>

<style scoped>
.editor-aside {
  min-height: 0;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  border: 1px solid var(--editor-border-soft);
  background: var(--editor-surface-raised);
  border-radius: 6px;
}
.editor-form {
  flex: 1;
  min-height: 0;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 12px;
}
.span-full {
  grid-column: 1 / -1;
}
.field-tip {
  margin-top: 2px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
  line-height: 1.3;
}
.field-tip code {
  font-family: var(--el-font-family-mono);
  color: var(--el-color-primary-dark-2);
}
.headers-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.headers-status .status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.headers-status.is-valid {
  color: var(--el-color-success);
}
.headers-status.is-invalid {
  color: var(--el-color-danger);
}
.headers-status.is-empty {
  color: var(--el-text-color-secondary);
}
.label-with-action {
  display: flex;
  align-items: center;
  gap: 6px;
}
.label-with-action :deep(.el-button) {
  padding: 0 4px;
  height: auto;
  min-height: 0;
  line-height: 1.2;
}
:deep(.editor-form .el-form-item) {
  margin-bottom: 8px;
}
:deep(.editor-form .el-form-item__label) {
  padding-bottom: 2px;
  font-size: 12px;
  line-height: 1.3;
}
:deep(.editor-form .el-input__inner),
:deep(.editor-form .el-textarea__inner) {
  font-size: 12px;
}
:deep(.editor-form .el-form-item__error) {
  padding-top: 2px;
  font-size: 11px;
  line-height: 1.3;
}
@media (max-width: 768px) {
  .editor-aside {
    border-radius: 8px;
  }
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
