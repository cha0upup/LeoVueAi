<template>
  <el-card
    class="io-card input-card class-input-card"
    shadow="never"
  >
    <template #header>
      <div class="card-header-title">
        <el-icon class="header-icon input-icon">
          <Icon :icon="icons.coffeeCup" />
        </el-icon>
        <span>字节码输入</span>
        <span class="header-hint">PluginComponent.pluginBytecode</span>
      </div>
    </template>

    <el-tabs
      v-model="inputMode"
      class="bytecode-tabs"
    >
      <el-tab-pane
        label="上传 .class"
        name="file"
      >
        <el-upload
          :auto-upload="false"
          :show-file-list="false"
          :disabled="disabled"
          accept=".class"
          :on-change="onFileSelected"
          drag
          class="class-uploader"
        >
          <el-icon class="upload-icon">
            <Icon :icon="icons.documentAdd" />
          </el-icon>
          <div class="el-upload__text">
            拖拽 .class 到此处，或<em>点击选择</em>
          </div>
        </el-upload>
      </el-tab-pane>
      <el-tab-pane
        label="粘贴 Base64"
        name="base64"
      >
        <el-input
          v-model="base64Input"
          type="textarea"
          :rows="6"
          :disabled="disabled"
          placeholder="直接粘贴 base64 字节码（首字符应为 yv66… 对应 magic cafebabe）"
          spellcheck="false"
          class="code-input"
          @blur="applyBase64"
        />
        <div class="base64-actions">
          <el-button
            size="small"
            :disabled="disabled || !base64Input.trim()"
            @click="applyBase64"
          >
            应用
          </el-button>
          <el-button
            size="small"
            text
            :disabled="disabled || !modelValue.base64"
            @click="base64Input = modelValue.base64"
          >
            回填当前值
          </el-button>
        </div>
      </el-tab-pane>
    </el-tabs>

    <div
      v-if="modelValue.base64"
      class="bytecode-meta"
    >
      <div class="meta-row">
        <span class="meta-key">来源</span>
        <span class="meta-val">{{ modelValue.fileName || '手工粘贴' }}</span>
      </div>
      <div class="meta-row">
        <span class="meta-key">字节码</span>
        <span class="meta-val">
          {{ formatByteSize(modelValue.size) }} · base64 {{ modelValue.base64.length }} 字符
          <el-tag
            size="small"
            :type="modelValue.magicValid ? 'success' : 'warning'"
            class="magic-tag"
          >
            {{ modelValue.magicValid ? 'magic ✓' : 'magic ⚠' }}
          </el-tag>
        </span>
      </div>
      <div class="meta-row">
        <span class="meta-key">前 16 字节</span>
        <span class="meta-val mono">{{ modelValue.preview }}</span>
      </div>
    </div>

    <div class="param-block">
      <div class="param-label">
        <el-icon><Icon :icon="icons.edit" /></el-icon>
        入参 JSON（可选）
      </div>
      <el-input
        :model-value="pluginParam"
        type="textarea"
        :rows="4"
        :disabled="disabled"
        placeholder="{&quot;cmd&quot;:&quot;whoami&quot;}"
        spellcheck="false"
        class="code-input"
        @update:model-value="$emit('update:plugin-param', $event)"
      />
    </div>
  </el-card>
</template>

<script setup>
import { onUnmounted, ref, watch } from 'vue'

import { icons } from '@/utils/icons.js'
import { showError, showSuccess, showWarning } from '@/utils/messageUtils.js'
import { analyzeBytecode, decodeBytecodeBase64, formatByteSize } from './scriptEditorModel.js'

const props = defineProps({
  modelValue: { type: Object, required: true },
  pluginParam: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  resetKey: { type: [String, Number], default: '' }
})

const emit = defineEmits(['update:model-value', 'update:plugin-param'])
const inputMode = ref('file')
const base64Input = ref('')
let fileReadSequence = 0
let mounted = true
let lastAppliedBase64 = ''

watch(
  () => props.modelValue.base64,
  value => {
    lastAppliedBase64 = value || ''
    if (!value) base64Input.value = ''
  }
)

watch(
  () => props.resetKey,
  () => { fileReadSequence += 1 }
)

const onFileSelected = async uploadFile => {
  const file = uploadFile?.raw || uploadFile
  if (!file) return
  if (!file.name?.toLowerCase().endsWith('.class')) {
    showWarning('请选择 .class 文件')
    return
  }
  const sequence = ++fileReadSequence
  try {
    const descriptor = analyzeBytecode(new Uint8Array(await file.arrayBuffer()), file.name)
    if (!mounted || sequence !== fileReadSequence) return
    emit('update:model-value', descriptor)
    base64Input.value = descriptor.base64
    lastAppliedBase64 = descriptor.base64
    showSuccess(`已加载 ${file.name}`)
  } catch (error) {
    if (mounted && sequence === fileReadSequence) showError('读取文件失败: ' + (error?.message || error))
  }
}

onUnmounted(() => {
  mounted = false
  fileReadSequence += 1
})

const applyBase64 = () => {
  if (!base64Input.value.trim()) return
  try {
    const descriptor = decodeBytecodeBase64(base64Input.value)
    if (descriptor.base64 === lastAppliedBase64) {
      base64Input.value = descriptor.base64
      return
    }
    emit('update:model-value', descriptor)
    base64Input.value = descriptor.base64
    lastAppliedBase64 = descriptor.base64
    showSuccess(
      `已应用 ${formatByteSize(descriptor.size)} 字节码${descriptor.magicValid ? '' : '（magic 不是 cafebabe）'}`
    )
  } catch (error) {
    showError('base64 解码失败：' + (error?.message || error))
  }
}
</script>

<style scoped>
.io-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--el-border-color);
  border-radius: var(--radius-container);
}

.io-card :deep(.el-card__header) {
  flex-shrink: 0;
}

.io-card :deep(.el-card__body) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 12px;
}

.input-card {
  border-left: 3px solid color-mix(in srgb, var(--el-color-primary) 72%, transparent);
}

.card-header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--el-text-color-primary);
  font-size: 14px;
  font-weight: 600;
}

.header-icon {
  font-size: 16px;
}

.input-icon {
  color: var(--el-color-primary);
}

.header-hint {
  margin-left: 6px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: 500;
}

.code-input {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
}

.code-input :deep(.el-textarea) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.code-input :deep(.el-textarea__inner) {
  flex: 1;
  min-height: 0;
  height: 100% !important;
  padding: 12px;
  resize: none;
  border: 1px solid var(--el-border-color);
  border-radius: var(--radius-control);
  background: var(--app-control-background);
  line-height: 1.6;
}

.bytecode-meta {
  margin-top: 12px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  border-radius: var(--radius-control);
  background: color-mix(in srgb, var(--app-control-background-soft) 70%, transparent);
  font-size: 12px;
}

.meta-row {
  display: flex;
  gap: 12px;
}

.meta-key {
  min-width: 70px;
  color: var(--el-text-color-secondary);
  font-weight: 600;
}

.meta-val {
  color: var(--el-text-color-primary);
  word-break: break-all;
}

.mono {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
}

.magic-tag {
  margin-left: 6px;
}

.class-input-card :deep(.el-card__body) {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bytecode-tabs :deep(.el-tabs__header) {
  margin: 0 0 8px;
}

.class-uploader :deep(.el-upload-dragger) {
  padding: 24px 12px;
  border-radius: var(--radius-container);
}

.upload-icon {
  color: var(--el-color-primary);
  font-size: 32px;
}

.base64-actions {
  margin-top: 6px;
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

.param-block {
  padding-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-top: 1px dashed color-mix(in srgb, var(--el-border-color) 50%, transparent);
}

.param-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: 600;
}
</style>
