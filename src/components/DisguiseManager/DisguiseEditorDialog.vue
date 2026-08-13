<template>
  <el-dialog
    v-model="visible"
    :show-close="false"
    width="78%"
    top="6vh"
    :close-on-click-modal="false"
    :before-close="handleBeforeClose"
    class="disguise-editor-dialog"
  >
    <header class="dialog-header">
      <div class="dialog-title-block">
        <span class="dialog-kicker">{{ mode === 'add' ? 'Create Disguise' : 'Edit Disguise' }}</span>
        <h2>{{ mode === 'add' ? '新增伪装' : '编辑伪装' }}</h2>
      </div>
      <div class="dialog-meta">
        <span>{{ activeTab === 'edit' ? '代码编辑' : '互逆测试' }}</span>
        <span>{{ headersStatus.message }}</span>
        <span
          v-if="isDirty"
          class="dirty-dot"
        >未保存</span>
      </div>
      <button
        class="dialog-close"
        type="button"
        aria-label="关闭"
        @click="handleClose"
      >
        <el-icon><Icon :icon="iconMap.close" /></el-icon>
      </button>
    </header>

    <div class="editor-shell">
      <DisguiseEditorForm
        ref="formRef"
        v-model:disguise-id="formData.disguiseId"
        v-model:disguise-name="formData.disguiseName"
        v-model:version="formData.version"
        v-model:supported-runtimes="formData.supportedRuntimes"
        v-model:headers-text="formData.headersText"
        v-model:description="formData.description"
        v-model:remark="formData.remark"
        :mode="mode"
        :auto-id-preview="autoIdPreview"
        :headers-status="headersStatus"
        @insert-header-example="insertHeaderExample"
      />

      <section class="editor-main">
        <div class="editor-toolbar">
          <div class="tab-bar">
            <button
              type="button"
              class="tab-btn"
              :class="{ 'is-active': activeTab === 'edit' }"
              @click="activeTab = 'edit'"
            >
              编辑
            </button>
            <button
              type="button"
              class="tab-btn"
              :class="{ 'is-active': activeTab === 'test' }"
              @click="switchToTestTab"
            >
              互逆测试
            </button>
          </div>
          <div class="toolbar-actions">
            <el-button
              size="small"
              plain
              @click="openTemplatePicker"
            >
              <el-icon><Icon :icon="iconMap.copyDocument" /></el-icon>
              从模板
            </el-button>
          </div>
        </div>

        <!-- ─── 编辑 tab ──────────────────────────────────────────────────── -->
        <div
          v-show="activeTab === 'edit'"
          class="code-grid"
        >
          <div class="code-panel">
            <div class="code-panel-header">
              <span
                class="code-title"
                title="完整 Java 方法，输入 HashMap params，返回 byte[]"
              >encodeBody</span>
            </div>
            <div
              ref="encodeEditorContainer"
              class="monaco-editor-container"
            />
          </div>

          <div class="code-panel">
            <div class="code-panel-header">
              <span
                class="code-title"
                title="完整 Java 方法，输入 byte[] data，返回 HashMap"
              >decodeBody</span>
            </div>
            <div
              ref="decodeEditorContainer"
              class="monaco-editor-container"
            />
          </div>

          <div
            v-if="phpEnabled"
            class="code-panel"
          >
            <div class="code-panel-header">
              <span class="code-title">phpEncodeBody</span>
            </div>
            <el-input
              v-model="formData.phpEncodeBody"
              class="php-source-input"
              type="textarea"
              resize="none"
              placeholder="函数体：接收 $payload，返回字符串"
            />
          </div>

          <div
            v-if="phpEnabled"
            class="code-panel"
          >
            <div class="code-panel-header">
              <span class="code-title">phpDecodeBody</span>
            </div>
            <el-input
              v-model="formData.phpDecodeBody"
              class="php-source-input"
              type="textarea"
              resize="none"
              placeholder="函数体：接收 $body，返回数组"
            />
          </div>
        </div>

        <DisguisePreviewPanel
          v-show="activeTab === 'test'"
          v-model:params-text="previewParamsText"
          :loading="previewLoading"
          :result="previewResult"
          :runtime-result="runtimeValidationResult"
          :error="previewError"
          @run="runPreview"
        />
      </section>
    </div>

    <footer class="dialog-footer">
      <div class="footer-hint">
        <span v-if="isDirty">有未保存修改</span>
        <span v-else>所有内容已同步</span>
      </div>
      <div class="footer-actions">
        <el-button
          size="small"
          @click="handleClose"
        >
          取消
        </el-button>
        <el-button
          size="small"
          type="primary"
          :loading="loading"
          @click="handleSubmit"
        >
          <el-icon><Icon :icon="iconMap.save" /></el-icon>
          {{ submitLabel }}
        </el-button>
      </div>
    </footer>

    <DisguiseTemplatePicker
      v-model="templatePickerVisible"
      v-model:selected="selectedTemplate"
      :templates="systemTemplates"
      :loading="templateLoading"
      @apply="applyTemplate"
    />
  </el-dialog>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, toRaw, watch } from 'vue'

import { monaco } from '@/utils/monaco.js'
import { icons } from '@/utils/icons.js'
import { createMonacoEditorOptions } from '@/composables/useMonacoEditorOptions.js'
import { useMonacoTheme } from '@/composables/useMonacoTheme.js'
import { useDialogVisible } from '@/composables/useDialogVisible.js'
import { useDirtyTracker } from '@/composables/useDirtyTracker.js'
import { useSaveShortcut } from '@/composables/useSaveShortcut.js'
import { useConfirmClose } from '@/composables/useConfirmClose.js'
import { showWarning } from '@/utils/messageUtils.js'
import { getDisguisesApi, previewDisguiseApi, testRuntimeDisguiseApi } from '@/services/api.js'
import DisguiseEditorForm from './DisguiseEditorForm.vue'
import DisguisePreviewPanel from './DisguisePreviewPanel.vue'
import DisguiseTemplatePicker from './DisguiseTemplatePicker.vue'
import {
  DEFAULT_DISGUISE_HEADERS,
  DEFAULT_PHP_DECODE,
  DEFAULT_PHP_ENCODE,
  applyDisguiseTemplate,
  buildDisguisePayload,
  buildDisguisePreviewPayload,
  createDisguiseEditorForm,
  createDisguiseIdPreview,
  filterSystemDisguiseTemplates,
  normalizeDisguiseRuntimes,
  resolveDisguiseHeadersStatus
} from './disguiseEditorModel.js'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  mode: {
    type: String,
    default: 'add'
  },
  disguise: {
    type: Object,
    default: null
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'submit'])

const iconMap = icons
const visible = useDialogVisible(props, emit)
const activeTab = ref('edit')

// ─── 模板选择器 ────────────────────────────────────────────────────────────────
const templatePickerVisible = ref(false)
const systemTemplates = ref([])
const selectedTemplate = ref(null)
const templateLoading = ref(false)
let templateRequestSequence = 0

async function openTemplatePicker() {
  const requestSequence = ++templateRequestSequence
  selectedTemplate.value = null
  templatePickerVisible.value = true
  if (!systemTemplates.value.length) {
    templateLoading.value = true
    try {
      const res = await getDisguisesApi()
      if (requestSequence !== templateRequestSequence) return
      const all = res.data || []
      systemTemplates.value = filterSystemDisguiseTemplates(all)
    } catch {
      if (requestSequence !== templateRequestSequence) return
      systemTemplates.value = []
    } finally {
      if (requestSequence === templateRequestSequence) templateLoading.value = false
    }
  }
}

watch(templatePickerVisible, (value) => {
  if (value) return
  templateRequestSequence += 1
  templateLoading.value = false
})

function applyTemplate() {
  const tpl = selectedTemplate.value
  if (!tpl) return
  applyDisguiseTemplate(formData, tpl)
  syncEditors()
  templatePickerVisible.value = false
}

// ─── 互逆测试 ──────────────────────────────────────────────────────────────────
const previewLoading = ref(false)
const previewResult = ref(null)
const runtimeValidationResult = ref(null)
const previewError = ref('')
const previewParamsText = ref('{"testKey":"hello_world","sessionId":"preview"}')
let previewRequestSequence = 0

function switchToTestTab() {
  activeTab.value = 'test'
}

async function runPreview() {
  if (!formData.encodeBody?.trim() || !formData.decodeBody?.trim()) return
  const requestSequence = ++previewRequestSequence
  const formSnapshot = snapshotForm()
  const paramsSnapshot = previewParamsText.value
  const isCurrentPreview = () =>
    requestSequence === previewRequestSequence &&
    formSnapshot === snapshotForm() &&
    paramsSnapshot === previewParamsText.value
  const payload = buildDisguisePreviewPayload(formData, previewParamsText.value)
  const runtimePayload = phpEnabled.value
    ? {
        ...payload,
        schemaVersion: 2,
        protocolVersion: 2,
        supportedRuntimes: normalizeDisguiseRuntimes(formData.supportedRuntimes),
        phpEncodeBody: formData.phpEncodeBody,
        phpDecodeBody: formData.phpDecodeBody
      }
    : null
  previewLoading.value = true
  previewError.value = ''
  previewResult.value = null
  runtimeValidationResult.value = null
  try {
    const res = await previewDisguiseApi(payload)
    if (!isCurrentPreview()) return
    previewResult.value = res.data
    if (runtimePayload) {
      const runtimeRes = await testRuntimeDisguiseApi(runtimePayload)
      if (!isCurrentPreview()) return
      runtimeValidationResult.value = runtimeRes.data || null
    }
  } catch (error) {
    if (!isCurrentPreview()) return
    previewError.value = error?.response?.data?.msg || error?.message || '未知错误'
  } finally {
    if (requestSequence === previewRequestSequence) previewLoading.value = false
  }
}

const formRef = ref(null)
const encodeEditor = ref(null)
const decodeEditor = ref(null)
const encodeEditorContainer = ref(null)
const decodeEditorContainer = ref(null)
let submitValidationSequence = 0

const formData = reactive(createDisguiseEditorForm())

const phpEnabled = computed(() => formData.supportedRuntimes.includes('php'))

watch(phpEnabled, (enabled) => {
  if (!enabled) return
  if (!formData.phpEncodeBody) formData.phpEncodeBody = DEFAULT_PHP_ENCODE
  if (!formData.phpDecodeBody) formData.phpDecodeBody = DEFAULT_PHP_DECODE
  formData.schemaVersion = 2
  formData.protocolVersion = 2
})

function snapshotForm() {
  return JSON.stringify({
    disguiseId: formData.disguiseId,
    disguiseName: formData.disguiseName,
    version: formData.version,
    headersText: formData.headersText,
    description: formData.description,
    remark: formData.remark,
    encodeBody: formData.encodeBody,
    decodeBody: formData.decodeBody,
    schemaVersion: formData.schemaVersion,
    protocolVersion: formData.protocolVersion,
    supportedRuntimes: [...formData.supportedRuntimes],
    phpEncodeBody: formData.phpEncodeBody,
    phpDecodeBody: formData.phpDecodeBody
  })
}

const { isDirty, reset: resetDirtyBaseline } = useDirtyTracker(snapshotForm)

const headersStatus = computed(() => resolveDisguiseHeadersStatus(formData.headersText))

const { monacoTheme, disposeMonacoEditors, watchMonacoTheme } = useMonacoTheme()
const submitLabel = computed(() => (props.mode === 'add' ? '创建伪装' : '保存修改'))
const autoIdPreview = computed(() => createDisguiseIdPreview(formData))

watch(
  () => props.modelValue,
  async (value) => {
    if (value) {
      activeTab.value = 'edit'
      hydrateForm()
      await nextTick()
      initEditors()
    } else {
      previewRequestSequence += 1
      templateRequestSequence += 1
      submitValidationSequence += 1
      previewLoading.value = false
      templatePickerVisible.value = false
      disposeEditors()
    }
  },
  { immediate: true }
)

watch(
  () => props.disguise,
  () => {
    if (visible.value) {
      hydrateForm()
      syncEditors()
    }
  }
)

const stopMonacoThemeWatch = watchMonacoTheme(() => [encodeEditor.value, decodeEditor.value])

useSaveShortcut(visible, () => handleSubmit(), {
  isLoading: () => props.loading
})

const { handleBeforeClose, handleClose } = useConfirmClose({
  isDirty,
  onClose: () => {
    visible.value = false
  }
})

function hydrateForm() {
  submitValidationSequence += 1
  Object.assign(formData, createDisguiseEditorForm(props.disguise))
  previewRequestSequence += 1
  previewLoading.value = false
  previewResult.value = null
  runtimeValidationResult.value = null
  previewError.value = ''
  formRef.value?.clearValidate()
  resetDirtyBaseline()
}

function initEditors() {
  disposeEditors()

  if (!encodeEditorContainer.value || !decodeEditorContainer.value) {
    return
  }

  encodeEditor.value = monaco.editor.create(
    toRaw(encodeEditorContainer.value),
    createEditorOptions(formData.encodeBody)
  )
  decodeEditor.value = monaco.editor.create(
    toRaw(decodeEditorContainer.value),
    createEditorOptions(formData.decodeBody)
  )

  toRaw(encodeEditor.value).onDidChangeModelContent(() => {
    formData.encodeBody = toRaw(encodeEditor.value).getValue()
  })

  toRaw(decodeEditor.value).onDidChangeModelContent(() => {
    formData.decodeBody = toRaw(decodeEditor.value).getValue()
  })
}

function createEditorOptions(value) {
  return createMonacoEditorOptions({
    value,
    language: 'java',
    theme: monacoTheme.value,
    minimapEnabled: false,
    fontSize: 13,
    lineHeight: 20,
    lineNumbers: 'on',
    roundedSelection: false,
    folding: true,
    tabSize: 4
  })
}

function syncEditors() {
  if (encodeEditor.value) {
    toRaw(encodeEditor.value).setValue(formData.encodeBody)
  }
  if (decodeEditor.value) {
    toRaw(decodeEditor.value).setValue(formData.decodeBody)
  }
}

function disposeEditors() {
  disposeMonacoEditors(encodeEditor, decodeEditor)
}

function normalizePayload() {
  return buildDisguisePayload(formData)
}

function insertHeaderExample() {
  formData.headersText = DEFAULT_DISGUISE_HEADERS
}

function handleSubmit() {
  if (props.loading) return
  formData.encodeBody = encodeEditor.value
    ? toRaw(encodeEditor.value).getValue()
    : formData.encodeBody
  formData.decodeBody = decodeEditor.value
    ? toRaw(decodeEditor.value).getValue()
    : formData.decodeBody

  if (!formData.encodeBody.trim() || !formData.decodeBody.trim()) {
    showWarning('encodeBody 和 decodeBody 不能为空')
    return
  }

  if (phpEnabled.value && (!formData.phpEncodeBody.trim() || !formData.phpDecodeBody.trim())) {
    showWarning('PHP encode/decode 函数体需要同时填写')
    return
  }

  if (headersStatus.value.state !== 'valid') {
    showWarning(`Headers ${headersStatus.value.message}`)
    return
  }

  const validationSequence = ++submitValidationSequence
  formRef.value?.validate((valid) => {
    if (validationSequence !== submitValidationSequence || !visible.value) return
    if (!valid) {
      showWarning('请先修正表单中的必填项')
      return
    }

    emit('submit', normalizePayload())
  })
}

onBeforeUnmount(() => {
  stopMonacoThemeWatch()
  disposeEditors()
})
</script>

<style scoped>
:deep(.disguise-editor-dialog) {
  --el-dialog-padding-primary: 0;
}

:deep(.disguise-editor-dialog .el-dialog) {
  border-radius: var(--radius-overlay);
  overflow: hidden;
  backdrop-filter: blur(16px);
  max-height: 86vh;
  display: flex;
  flex-direction: column;
}

:deep(.disguise-editor-dialog .el-dialog__body) {
  padding: 0 !important;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

:global(.el-dialog.disguise-editor-dialog > .el-dialog__header),
:deep(.disguise-editor-dialog .el-dialog__header) {
  display: none;
  padding: 0;
}

.dialog-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 28px;
  align-items: center;
  gap: 14px;
  min-height: 48px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--editor-border-soft);
  background: color-mix(in srgb, var(--editor-surface-raised) 92%, var(--el-bg-color-overlay));
}

.dialog-title-block {
  min-width: 0;
}

.dialog-kicker {
  display: block;
  margin-bottom: 2px;
  color: var(--el-text-color-placeholder);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  line-height: 1;
  text-transform: uppercase;
}

.dialog-title-block h2 {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 15px;
  font-weight: 800;
  line-height: 1.2;
}

.dialog-meta {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px 12px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.dialog-meta span {
  position: relative;
  line-height: 1.4;
}

.dialog-meta span + span::before {
  content: '';
  position: absolute;
  left: -7px;
  top: 50%;
  width: 3px;
  height: 3px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--el-text-color-secondary) 42%, transparent);
}

.dirty-dot {
  color: var(--el-color-warning);
  font-weight: 700;
}

.dialog-close {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
}

.dialog-close:hover {
  border-color: color-mix(in srgb, var(--el-color-primary) 22%, transparent);
  background: color-mix(in srgb, var(--el-color-primary) 7%, transparent);
  color: var(--el-color-primary);
}

.disguise-editor-dialog {
  --editor-surface-raised: color-mix(
    in srgb,
    var(--app-control-background-soft) 88%,
    var(--el-bg-color-overlay)
  );
  --editor-surface-raised-strong: color-mix(
    in srgb,
    var(--app-control-background-hover) 92%,
    var(--el-bg-color-overlay)
  );
  --editor-surface-muted: color-mix(
    in srgb,
    var(--app-control-background) 94%,
    var(--el-bg-color-overlay)
  );
  --editor-border-soft: color-mix(in srgb, var(--el-border-color) 15%, transparent);
}

.editor-shell {
  display: grid;
  grid-template-columns: minmax(300px, 330px) minmax(0, 1fr);
  gap: 8px;
  flex: 1;
  min-height: 0;
  padding: 10px;
  overflow: hidden;
}

.editor-main {
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--editor-border-soft);
  background: var(--editor-surface-raised);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0;
  flex-shrink: 0;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}

/* ─── Tab bar ─────────────────────────────────────────────────────────────── */

.tab-bar {
  display: flex;
  align-items: center;
  gap: 2px;
  background: var(--editor-surface-muted);
  border: 1px solid var(--editor-border-soft);
  border-radius: 7px;
  padding: 1px;
}

.tab-btn {
  padding: 2px 11px;
  font-size: 12px;
  font-weight: 500;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
  white-space: nowrap;
}

.tab-btn:hover {
  color: var(--el-text-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 8%, transparent);
}

.tab-btn.is-active {
  background: var(--el-bg-color-overlay);
  color: var(--el-color-primary);
  font-weight: 600;
  box-shadow: 0 1px 4px color-mix(in srgb, var(--el-border-color) 60%, transparent);
}

.code-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.code-panel {
  min-height: 0;
  border-radius: 6px;
  border: 1px solid var(--editor-border-soft);
  background: var(--editor-surface-raised-strong);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.code-panel-header {
  padding: 5px 8px;
  border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 20%, transparent);
  flex-shrink: 0;
}

.code-title {
  display: inline-block;
  font-size: 12px;
  font-weight: 700;
}

.monaco-editor-container {
  flex: 1;
  min-height: 0;
  height: 100%;
}

.php-source-input {
  flex: 1;
  min-height: 0;
}

.php-source-input :deep(.el-textarea),
.php-source-input :deep(.el-textarea__inner) {
  height: 100%;
}

.php-source-input :deep(.el-textarea__inner) {
  border: 0;
  border-radius: 0;
  box-shadow: none;
  font-family: var(--el-font-family-mono);
  font-size: 12px;
  line-height: 1.5;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  flex-shrink: 0;
  min-height: 48px;
  padding: 8px 14px;
  background: var(--editor-surface-raised);
  border-top: 1px solid var(--editor-border-soft);
}

.footer-hint {
  margin-right: auto;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.footer-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

@media (max-width: 1180px) {
  .editor-shell {
    grid-template-columns: 1fr;
    overflow-y: auto;
  }

  .editor-main {
    min-height: 50vh;
  }
}

@media (max-width: 768px) {
  :deep(.disguise-editor-dialog .el-dialog) {
    width: calc(100vw - 16px) !important;
    margin: 8px auto;
  }

  :deep(.disguise-editor-dialog .el-dialog__body) {
    padding: 0 6px 8px;
  }

  .dialog-header {
    grid-template-columns: minmax(0, 1fr) 28px;
  }

  .dialog-meta {
    grid-column: 1 / -1;
    justify-content: flex-start;
  }

  .editor-shell {
    gap: 5px;
    padding: 8px 0;
  }

  .editor-main {
    border-radius: 8px;
  }


  .editor-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .toolbar-actions {
    justify-content: flex-end;
  }

  .monaco-editor-container {
    min-height: 160px;
  }

  .dialog-footer {
    align-items: stretch;
    flex-direction: column;
    gap: 8px;
  }

  .footer-actions {
    justify-content: flex-end;
  }
}
</style>
