<template>
  <div class="script-editor">
    <!-- 工具栏 -->
    <div class="editor-toolbar">
      <div class="toolbar-left">
        <!-- 模式切换：脚本 / Java Class -->
        <el-radio-group
          v-model="mode"
          size="default"
          :disabled="isExecuting || isSaving"
        >
          <el-radio-button
            v-if="canUseScriptMode"
            value="script"
          >
            脚本
          </el-radio-button>
          <el-radio-button
            v-if="canUseClassMode"
            value="class"
          >
            Java Class
          </el-radio-button>
        </el-radio-group>

        <!-- 脚本模式：语言下拉 -->
        <template v-if="mode === 'script'">
          <span class="toolbar-label">语言</span>
          <el-select
            v-model="language"
            size="default"
            class="lang-select"
            :disabled="isExecuting || isSaving"
          >
            <el-option
              v-for="opt in languageOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </template>

        <!-- Class 模式：仅保留语言/状态指示，上传 + base64 输入移到主区域 -->
        <template v-else>
          <span class="toolbar-label class-mode-hint">
            <el-icon><Icon :icon="iconMap.coffeeCup" /></el-icon>
            Java 字节码
          </span>
          <span
            v-if="bytecode.fileName"
            class="class-file-chip"
          >
            <el-icon><Icon :icon="iconMap.document" /></el-icon>
            {{ bytecode.fileName }}
          </span>
          <span
            v-if="bytecode.base64"
            class="size-chip"
            :class="{ invalid: !bytecode.magicValid }"
          >
            {{ formatByteSize(bytecode.size) }}
            <span class="magic-hint">{{ bytecode.magicValid ? '✓ cafebabe' : '⚠ magic 不符' }}</span>
          </span>
        </template>

        <span
          v-if="lastDurationMs != null"
          class="latency-chip"
        >
          <el-icon><Icon :icon="iconMap.refresh" /></el-icon>
          {{ lastDurationMs }} ms
        </span>
      </div>

      <div class="toolbar-actions">
        <el-button
          size="default"
          :disabled="!canClear || isExecuting || isSaving"
          @click="clearAll"
        >
          <el-icon><Icon :icon="iconMap.delete" /></el-icon>
          清空
        </el-button>
        <el-button
          size="default"
          :disabled="!canSave || isExecuting || isSaving"
          @click="openSaveDialog"
        >
          <el-icon><Icon :icon="iconMap.documentAdd" /></el-icon>
          保存为插件
        </el-button>
        <el-button
          type="primary"
          size="default"
          :loading="isExecuting"
          :disabled="!canExecute || isSaving"
          @click="execute"
        >
          <el-icon v-if="!isExecuting">
            <Icon :icon="iconMap.play" />
          </el-icon>
          执行
        </el-button>
      </div>
    </div>

    <!-- 编辑区 + 结果区 -->
    <div class="editor-body">
      <el-row
        :gutter="16"
        class="io-row"
      >
        <el-col :span="12">
          <!-- 脚本模式：脚本内容 -->
          <el-card
            v-if="mode === 'script'"
            class="io-card input-card"
            shadow="never"
          >
            <template #header>
              <div class="card-header-title">
                <el-icon class="header-icon input-icon">
                  <Icon :icon="iconMap.codeEdit" />
                </el-icon>
                <span>脚本</span>
                <span class="header-hint">{{ languageHint }}</span>
              </div>
            </template>
            <el-input
              v-model="script"
              type="textarea"
              :rows="18"
              :placeholder="placeholderText"
              :disabled="isExecuting || isSaving"
              spellcheck="false"
              class="code-input"
            />
          </el-card>

          <ScriptBytecodeInput
            v-else
            v-model="bytecode"
            :plugin-param="pluginParam"
            :disabled="isExecuting || isSaving"
            :reset-key="sessionId"
            @update:plugin-param="pluginParam = $event"
          />
        </el-col>

        <el-col :span="12">
          <el-card
            class="io-card output-card"
            shadow="never"
          >
            <template #header>
              <div class="card-header-title">
                <el-icon class="header-icon output-icon">
                  <Icon :icon="iconMap.document" />
                </el-icon>
                <span>执行结果</span>
                <div class="header-actions">
                  <el-button
                    :disabled="!resultText"
                    size="small"
                    text
                    @click="copyResult"
                  >
                    <el-icon><Icon :icon="iconMap.copyDocument" /></el-icon>
                    复制
                  </el-button>
                  <el-button
                    :disabled="!resultText"
                    size="small"
                    text
                    @click="resultText = ''"
                  >
                    <el-icon><Icon :icon="iconMap.delete" /></el-icon>
                    清空
                  </el-button>
                </div>
              </div>
            </template>
            <el-input
              v-model="resultText"
              type="textarea"
              :rows="18"
              readonly
              placeholder="点击「执行」查看结果"
              class="code-input result-input"
            />
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- 保存为插件弹窗 -->
    <el-dialog
      v-model="saveDialogVisible"
      title="保存为插件"
      width="520px"
      :close-on-click-modal="false"
      :close-on-press-escape="!isSaving"
      :show-close="!isSaving"
    >
      <el-form
        ref="saveFormRef"
        :model="saveForm"
        :rules="saveRules"
        label-width="84px"
      >
        <el-form-item
          label="名称"
          prop="pluginName"
        >
          <el-input
            v-model="saveForm.pluginName"
            placeholder="必填，将作为 pluginId 派生依据"
            maxlength="48"
            show-word-limit
          />
        </el-form-item>
        <el-form-item
          label="描述"
          prop="pluginDescription"
        >
          <el-input
            v-model="saveForm.pluginDescription"
            type="textarea"
            :rows="2"
            placeholder="用途说明，可选"
          />
        </el-form-item>
        <el-form-item label="版本">
          <el-input
            v-model="saveForm.version"
            placeholder="默认 1.0"
          />
        </el-form-item>
        <el-form-item
          v-if="mode === 'class'"
          label="入参示例"
        >
          <el-input
            v-model="saveForm.paramsDemo"
            type="textarea"
            :rows="2"
            placeholder="{&quot;cmd&quot;:&quot;whoami&quot;}"
          />
        </el-form-item>
        <el-form-item label="类型">
          <el-tag
            :type="mode === 'class' ? 'info' : 'warning'"
            size="default"
          >
            {{ mode === 'class' ? 'Java Class' : language }}
          </el-tag>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button
          :disabled="isSaving"
          @click="saveDialogVisible = false"
        >
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="isSaving"
          @click="confirmSave"
        >
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, inject, onUnmounted, ref, unref, watch } from 'vue'

import { icons } from '@/utils/icons.js'
import { execClassApi, execScriptApi } from '@/services/api/puppet-tools.js'
import { addPluginApi } from '@/services/api/plugins.js'
import { supportsCapabilityRequirements } from '@/composables/usePuppetConsoleModules.js'
import { createLatestRequestGuard } from '@/utils/latestRequestGuard.js'
import { showError, showSuccess, showWarning } from '@/utils/messageUtils.js'
import ScriptBytecodeInput from './ScriptBytecodeInput.vue'
import {
  buildPluginPayload,
  createEmptyBytecode,
  formatByteSize,
  formatExecutionResult,
  getScriptLanguageOptions,
  SCRIPT_PLACEHOLDERS
} from './scriptEditorModel.js'

const iconMap = icons
const puppetCapabilities = inject('puppetCapabilities', ref([]))
const puppetRuntime = inject('puppetRuntime', ref('java'))
const requestGuard = createLatestRequestGuard(['execute', 'save'])
let mounted = true

const props = defineProps({
  sessionId: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['plugin-saved'])
const mode = ref('script')
const language = ref('js')
const script = ref('')
const bytecode = ref(createEmptyBytecode())
const pluginParam = ref('')
const resultText = ref('')
const isExecuting = ref(false)
const lastDurationMs = ref(null)
const isSaving = ref(false)
const saveDialogVisible = ref(false)

const scriptModeCapability = { requiredCapabilities: ['script'] }
const classModeCapability = { requiredCapabilities: ['componentInvoke'] }
const canUseScriptMode = computed(() =>
  supportsCapabilityRequirements(scriptModeCapability, unref(puppetCapabilities))
)
const canUseClassMode = computed(() =>
  puppetRuntime.value !== 'php' &&
  supportsCapabilityRequirements(classModeCapability, unref(puppetCapabilities))
)
const languageOptions = computed(() => getScriptLanguageOptions(puppetRuntime.value))
const languageHint = computed(() =>
  languageOptions.value.find(option => option.value === language.value)?.label || ''
)
const placeholderText = computed(() => SCRIPT_PLACEHOLDERS[language.value] || '在此编写脚本…')

const canExecute = computed(() => {
  if (mode.value === 'script') return canUseScriptMode.value && !!script.value.trim()
  return canUseClassMode.value && !!bytecode.value.base64 && bytecode.value.magicValid
})
const canSave = computed(() => canExecute.value)
const canClear = computed(() => mode.value === 'script'
  ? !!script.value.trim() || !!resultText.value
  : !!bytecode.value.base64 || !!pluginParam.value || !!resultText.value
)

const resetOutput = () => {
  resultText.value = ''
  lastDurationMs.value = null
}

const resetEditorState = () => {
  script.value = ''
  bytecode.value = createEmptyBytecode()
  pluginParam.value = ''
  resetOutput()
}

watch(mode, () => {
  requestGuard.invalidate(['execute'])
  isExecuting.value = false
  resetOutput()
})

watch(puppetRuntime, (runtime, previousRuntime) => {
  requestGuard.invalidate(['execute'])
  isExecuting.value = false
  language.value = runtime === 'php' ? 'php' : 'js'
  mode.value = 'script'
  if (previousRuntime != null && runtime !== previousRuntime) {
    resetEditorState()
    if (!isSaving.value) saveDialogVisible.value = false
  }
}, { immediate: true })

watch(
  () => props.sessionId,
  (sessionId, previousSessionId) => {
    if (previousSessionId == null || sessionId === previousSessionId) return
    requestGuard.invalidate(['execute'])
    isExecuting.value = false
    resetEditorState()
    if (!isSaving.value) saveDialogVisible.value = false
  }
)

watch(
  [canUseScriptMode, canUseClassMode],
  ([scriptAvailable, classAvailable]) => {
    if (mode.value === 'script' && !scriptAvailable && classAvailable) mode.value = 'class'
    else if (mode.value === 'class' && !classAvailable && scriptAvailable) mode.value = 'script'
  },
  { immediate: true }
)

const execute = async () => {
  if (isExecuting.value) return
  if (!canExecute.value) {
    const message = mode.value === 'script'
      ? '脚本内容为空'
      : bytecode.value.base64 && !bytecode.value.magicValid
        ? 'Java Class magic 校验未通过'
        : '请先上传 .class 或粘贴 base64 字节码'
    showWarning(message)
    return
  }

  const sequence = requestGuard.next('execute')
  const sessionId = props.sessionId
  const executionMode = mode.value
  const startedAt = Date.now()
  isExecuting.value = true
  resultText.value = ''
  try {
    const response = executionMode === 'script'
      ? await execScriptApi({ sessionId, language: language.value, script: script.value })
      : await execClassApi({
          sessionId,
          bytecodeBase64: bytecode.value.base64,
          pluginParam: pluginParam.value
        })
    if (!mounted || !requestGuard.isCurrent('execute', sequence) || sessionId !== props.sessionId) return
    lastDurationMs.value = Date.now() - startedAt
    resultText.value = formatExecutionResult(response.data)
    showSuccess(executionMode === 'script' ? '脚本执行完成' : '字节码执行完成')
  } catch (error) {
    if (!mounted || !requestGuard.isCurrent('execute', sequence) || sessionId !== props.sessionId) return
    lastDurationMs.value = Date.now() - startedAt
    resultText.value = '执行失败：' + (error?.message || error)
    showError('执行失败: ' + (error?.message || error))
  } finally {
    if (requestGuard.isCurrent('execute', sequence)) isExecuting.value = false
  }
}

const clearAll = () => {
  if (isExecuting.value || isSaving.value) return
  if (mode.value === 'script') script.value = ''
  else {
    bytecode.value = createEmptyBytecode()
    pluginParam.value = ''
  }
  resetOutput()
}

const copyResult = async () => {
  if (!resultText.value) return
  try {
    await navigator.clipboard.writeText(resultText.value)
    if (mounted) showSuccess('结果已复制')
  } catch {
    if (mounted) showError('复制失败')
  }
}

const loadPlugin = plugin => {
  if (!plugin || isExecuting.value || isSaving.value || !canUseScriptMode.value) return
  const type = String(plugin.pluginType || 'js').toLowerCase()
  if (!languageOptions.value.some(option => option.value === type)) {
    showWarning('该插件类型与当前运行时不匹配')
    return
  }
  requestGuard.invalidate(['execute'])
  mode.value = 'script'
  language.value = type
  script.value = plugin.scriptText || plugin.content || ''
  resetOutput()
  showSuccess(`已载入 ${plugin.pluginName || plugin.pluginId}`)
}

const saveFormRef = ref(null)
const saveForm = ref({
  pluginName: '',
  pluginDescription: '',
  version: '1.0',
  paramsDemo: ''
})
const saveRules = {
  pluginName: [
    { required: true, message: '请输入插件名称', trigger: 'blur' },
    { pattern: /^[A-Za-z0-9_-]+$/, message: '仅支持字母、数字、下划线、短横线', trigger: 'blur' }
  ]
}

const openSaveDialog = () => {
  if (isSaving.value) return
  if (!canSave.value) {
    showWarning(mode.value === 'script' ? '脚本内容为空' : '请先提供有效的 Java Class 字节码')
    return
  }
  saveForm.value = {
    pluginName: '',
    pluginDescription: '',
    version: '1.0',
    paramsDemo: pluginParam.value || ''
  }
  saveDialogVisible.value = true
}

const confirmSave = async () => {
  if (!saveFormRef.value || isSaving.value) return
  isSaving.value = true
  try {
    await saveFormRef.value.validate()
  } catch {
    isSaving.value = false
    return
  }

  const sequence = requestGuard.next('save')
  const payload = buildPluginPayload({
    form: saveForm.value,
    mode: mode.value,
    language: language.value,
    runtime: puppetRuntime.value,
    script: script.value,
    bytecode: bytecode.value,
    pluginParam: pluginParam.value
  })
  try {
    const response = await addPluginApi(payload)
    if (!mounted || !requestGuard.isCurrent('save', sequence)) return
    showSuccess('插件保存成功')
    saveDialogVisible.value = false
    emit('plugin-saved', response?.data || null)
  } catch (error) {
    if (mounted && requestGuard.isCurrent('save', sequence)) {
      showError('保存失败: ' + (error?.message || error))
    }
  } finally {
    if (requestGuard.isCurrent('save', sequence)) isSaving.value = false
  }
}

onUnmounted(() => {
  mounted = false
  requestGuard.invalidate()
})

defineExpose({ loadPlugin })
</script>

<style scoped>
.script-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 0;
}

.editor-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: var(--radius-container);
  background: var(--app-control-background-soft);
  border: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  flex-wrap: wrap;
  flex-shrink: 0;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.toolbar-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  font-weight: 600;
}

.lang-select {
  width: 160px;
}

.class-file-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 30%, transparent);
}

.latency-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  font-family: var(--el-font-family-mono, 'Consolas', monospace);
  color: var(--el-color-info);
  background: color-mix(in srgb, var(--el-color-info) 12%, transparent);
}

.toolbar-actions {
  display: flex;
  gap: 8px;
}

.editor-body {
  flex: 1;
  min-height: 0;
}

.io-row {
  height: 100%;
}

.io-row :deep(.el-col) {
  height: 100%;
}

.io-card {
  height: 100%;
  border-radius: var(--radius-container);
  border: 1px solid var(--el-border-color);
  display: flex;
  flex-direction: column;
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

.output-card {
  border-left: 3px solid color-mix(in srgb, var(--el-color-info) 72%, transparent);
}

.card-header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.header-icon {
  font-size: 16px;
}

.input-icon {
  color: var(--el-color-primary);
}

.output-icon {
  color: var(--el-color-info);
}

.header-hint {
  margin-left: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--el-text-color-secondary);
}

.header-actions {
  margin-left: auto;
  display: flex;
  gap: 4px;
}

.code-input {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
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
  background: var(--app-control-background);
  border: 1px solid var(--el-border-color);
  border-radius: var(--radius-control);
  padding: 12px;
  line-height: 1.6;
  resize: none;
}

.code-input :deep(.el-textarea__inner):focus {
  border-color: color-mix(in srgb, var(--el-color-primary) 36%, var(--el-border-color));
  background: var(--el-bg-color);
}

.result-input :deep(.el-textarea__inner) {
  background: var(--app-control-background-soft);
  color: var(--el-text-color-primary);
}

.class-mode-hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--el-color-primary);
}

.size-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-color-success);
  background: color-mix(in srgb, var(--el-color-success) 12%, transparent);
}

.size-chip.invalid {
  color: var(--el-color-warning);
  background: color-mix(in srgb, var(--el-color-warning) 14%, transparent);
}

.magic-hint {
  font-weight: 400;
  opacity: 0.85;
}

</style>
