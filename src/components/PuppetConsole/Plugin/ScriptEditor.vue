<template>
  <div class="script-editor">
    <div class="editor-toolbar">
      <div class="toolbar-left">
        <el-radio-group
          v-model="mode"
          aria-label="执行类型"
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
        <el-select
          v-if="mode === 'script'"
          v-model="language"
          aria-label="脚本语言"
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
      </div>
      <div class="toolbar-actions">
        <span
          v-if="executionHint"
          class="execution-hint"
        >{{ executionHint }}</span>
        <el-button
          type="primary"
          :loading="isExecuting"
          :disabled="!canExecute || isSaving"
          @click="execute"
        >
          <el-icon v-if="!isExecuting">
            <Icon :icon="iconMap.play" />
          </el-icon>
          {{ isExecuting ? '执行中' : '执行' }}
        </el-button>
      </div>
    </div>

    <div
      ref="editorBody"
      class="editor-body"
    >
      <div
        class="editor-layout"
        :class="{ 'is-stacked': isStacked, 'is-expanded': editorExpanded }"
        :style="{ '--editor-width': `${editorWidth}px` }"
      >
        <section
          class="input-pane io-pane"
          aria-label="编辑区"
        >
          <div class="pane-header">
            <h3>编辑区</h3>
            <div class="pane-actions">
              <el-button
                size="small"
                text
                :disabled="!canClearInput || isExecuting || isSaving"
                @click="clearInput"
              >
                {{ mode === 'script' ? '清空脚本' : '清空输入' }}
              </el-button>
              <el-button
                size="small"
                text
                :disabled="!canExecute || isExecuting || isSaving"
                @click="openSaveDialog"
              >
                保存为插件
              </el-button>
              <el-button
                size="small"
                text
                :aria-label="editorExpanded ? '恢复分栏' : '展开编辑区'"
                :title="editorExpanded ? '恢复分栏' : '展开编辑区'"
                :aria-pressed="editorExpanded"
                @click="editorExpanded = !editorExpanded"
              >
                <el-icon><Icon :icon="editorExpanded ? 'mdi:fullscreen-exit' : iconMap.fullScreen" /></el-icon>
              </el-button>
            </div>
          </div>
          <el-input
            v-if="mode === 'script'"
            v-model="script"
            type="textarea"
            aria-label="脚本内容"
            :placeholder="placeholderText"
            :disabled="isExecuting || isSaving"
            spellcheck="false"
            class="code-input"
          />
          <ScriptBytecodeInput
            v-else
            v-model="bytecode"
            :plugin-param="pluginParam"
            :disabled="isExecuting || isSaving"
            :reset-key="sessionId"
            @update:plugin-param="pluginParam = $event"
          />
        </section>
        <SplitterBar
          v-show="!editorExpanded && !isStacked"
          v-model="editorWidth"
          :min="320"
          :max="maxEditorWidth"
          :aria-valuemin="320"
          :aria-valuemax="maxEditorWidth"
          :aria-valuenow="Math.round(editorWidth)"
          aria-label="调整编辑区宽度"
          title="拖动或使用左右方向键调整宽度"
          class="editor-splitter"
        />
        <section
          v-show="!editorExpanded"
          class="output-pane io-pane"
          aria-label="执行结果"
          :aria-busy="isExecuting"
        >
          <div class="pane-header">
            <h3>执行结果</h3>
            <div
              v-if="resultState !== 'idle'"
              class="pane-actions"
            >
              <el-button
                v-if="resultText"
                size="small"
                text
                @click="copyResult"
              >
                复制结果
              </el-button>
              <el-button
                size="small"
                text
                @click="resetOutput"
              >
                清空结果
              </el-button>
            </div>
          </div>
          <div
            v-if="isExecuting || resultState !== 'idle'"
            class="result-status"
            :class="isExecuting ? 'running' : resultState"
            role="status"
          >
            <span>{{ isExecuting ? '正在执行…' : resultState === 'success' ? '执行成功' : '执行失败' }}</span>
            <span v-if="lastDurationMs != null">{{ lastDurationMs }} ms</span>
          </div>
          <el-input
            v-if="resultText"
            :model-value="resultText"
            type="textarea"
            aria-label="执行结果内容"
            readonly
            spellcheck="false"
            class="code-input result-input"
          />
          <div
            v-else
            class="result-empty"
          >
            <el-icon><Icon :icon="iconMap.document" /></el-icon>
            <p>{{ isExecuting ? '等待节点返回结果' : resultState === 'success' ? '执行完成，无输出内容' : '执行后，结果将在这里显示' }}</p>
          </div>
        </section>
      </div>
    </div>

    <!-- 保存为插件弹窗 -->
    <el-dialog
      v-model="saveDialogVisible"
      title="保存为插件"
      width="min(520px, calc(100vw - 32px))"
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
import { computed, inject, onMounted, onUnmounted, ref, unref, watch } from 'vue'

import { icons } from '@/utils/icons.js'
import { execClassApi, execScriptApi } from '@/services/api/puppet-tools.js'
import { addPluginApi } from '@/services/api/plugins.js'
import { supportsCapabilityRequirements } from '@/composables/usePuppetConsoleModules.js'
import { createLatestRequestGuard } from '@/utils/latestRequestGuard.js'
import { showError, showSuccess, showWarning } from '@/utils/messageUtils.js'
import SplitterBar from '@/components/common/SplitterBar.vue'
import ScriptBytecodeInput from './ScriptBytecodeInput.vue'
import {
  buildPluginPayload,
  createEmptyBytecode,
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
const resultState = ref('idle')
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
const placeholderText = computed(() => SCRIPT_PLACEHOLDERS[language.value] || '在此编写脚本…')

const canExecute = computed(() => {
  if (mode.value === 'script') return canUseScriptMode.value && !!script.value.trim()
  return canUseClassMode.value && !!bytecode.value.base64 && bytecode.value.magicValid
})
const canClearInput = computed(() => mode.value === 'script'
  ? !!script.value
  : !!bytecode.value.base64 || !!pluginParam.value
)
const executionHint = computed(() => {
  if (isSaving.value) return '正在保存插件'
  if (canExecute.value) return ''
  if (mode.value === 'script') return canUseScriptMode.value ? '输入脚本后可执行' : '当前节点不支持脚本执行'
  if (!canUseClassMode.value) return '当前节点不支持 Java Class'
  return bytecode.value.base64 ? '请提供有效的 Java Class 字节码' : '上传 .class 或粘贴 Base64 后可执行'
})

const editorBody = ref(null)
const bodyWidth = ref(0)
const editorRatio = ref(0.6)
const editorExpanded = ref(false)
const isStacked = computed(() => bodyWidth.value < 720)
const availableWidth = computed(() => Math.max(0, bodyWidth.value - 6))
const maxEditorWidth = computed(() => Math.max(320, availableWidth.value - 280))
const editorWidth = computed({
  get: () => Math.max(320, Math.min(maxEditorWidth.value, availableWidth.value * editorRatio.value)),
  set: value => { editorRatio.value = value / Math.max(1, availableWidth.value) }
})
let resizeObserver
onMounted(() => {
  resizeObserver = new ResizeObserver(([entry]) => { bodyWidth.value = entry.contentRect.width })
  resizeObserver.observe(editorBody.value)
})

const resetOutput = () => {
  resultText.value = ''
  resultState.value = 'idle'
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
  resetOutput()
  editorExpanded.value = false
  isExecuting.value = true
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
    resultState.value = 'success'
    showSuccess(executionMode === 'script' ? '脚本执行完成' : '字节码执行完成')
  } catch (error) {
    if (!mounted || !requestGuard.isCurrent('execute', sequence) || sessionId !== props.sessionId) return
    lastDurationMs.value = Date.now() - startedAt
    resultText.value = '执行失败：' + (error?.message || error)
    resultState.value = 'error'
    showError('执行失败: ' + (error?.message || error))
  } finally {
    if (requestGuard.isCurrent('execute', sequence)) isExecuting.value = false
  }
}

const clearInput = () => {
  if (isExecuting.value || isSaving.value) return
  if (mode.value === 'script') script.value = ''
  else {
    bytecode.value = createEmptyBytecode()
    pluginParam.value = ''
  }
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
  if (!canExecute.value) {
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
  resizeObserver?.disconnect()
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
  min-width: 0;
}

.editor-toolbar,
.toolbar-left,
.toolbar-actions,
.pane-header,
.pane-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.editor-toolbar {
  justify-content: space-between;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.toolbar-left {
  flex-wrap: wrap;
  flex-shrink: 0;
  max-width: 100%;
}

.toolbar-actions {
  margin-left: auto;
}

.lang-select {
  width: 140px;
}

.execution-hint {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.editor-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.editor-layout {
  display: flex;
  height: 100%;
  min-height: 320px;
  border: 1px solid var(--el-border-color-light);
  border-radius: var(--radius-container);
  background: var(--el-bg-color);
  overflow: hidden;
}

.io-pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.input-pane {
  flex: 0 0 var(--editor-width);
}

.output-pane {
  flex: 1;
}

.editor-splitter {
  background: var(--el-fill-color-light);
}

.editor-splitter :deep(.splitter-handle) {
  border-inline: 1px solid var(--el-border-color-lighter);
}

.pane-header {
  flex-shrink: 0;
  min-height: 42px;
  padding: 6px 12px;
  flex-wrap: wrap;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.pane-header h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.pane-actions {
  gap: 0;
  margin-left: auto;
}

.pane-actions .el-button + .el-button {
  margin-left: 0;
}

.code-input {
  display: flex;
  flex: 1;
  min-height: 0;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
}

.code-input :deep(.el-textarea__inner) {
  flex: 1;
  min-height: 0 !important;
  height: 100% !important;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  background: transparent;
  padding: 14px;
  line-height: 1.7;
  resize: none;
}

.code-input :deep(.el-textarea__inner:focus-visible) {
  box-shadow: inset 0 0 0 1px var(--el-color-primary-light-5);
}

.result-input :deep(.el-textarea__inner) {
  color: var(--el-text-color-primary);
}

.result-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 14px;
  font-size: 12px;
  color: var(--el-color-primary);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.result-status.success {
  color: var(--el-color-success);
}

.result-status.error {
  color: var(--el-color-danger);
}

.result-empty {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.result-empty .el-icon {
  font-size: 28px;
  color: var(--el-text-color-placeholder);
}

.result-empty p {
  margin: 0;
}

.is-stacked {
  flex-direction: column;
  min-height: 520px;
}

.is-stacked .input-pane {
  flex: 3 0 280px;
}

.is-stacked .output-pane {
  flex: 2 0 220px;
  border-top: 1px solid var(--el-border-color-light);
}

.is-expanded {
  min-height: 320px;
}

.is-expanded .input-pane {
  flex: 1;
}
</style>
