<template>
  <el-dialog
    v-model="visible"
    :show-close="false"
    width="860px"
    :close-on-click-modal="false"
    :close-on-press-escape="!saving"
    class="fingerprint-dialog"
    @close="handleClose"
    @closed="handleClosed"
  >
    <header class="dialog-header">
      <div class="dialog-title-block">
        <span class="dialog-kicker">{{ isEdit ? 'Edit Fingerprint' : 'Create Fingerprint' }}</span>
        <h2>{{ isEdit ? '编辑指纹' : '新增指纹' }}</h2>
      </div>
      <div class="dialog-meta">
        <span>{{ (formData.protocol || 'http').toUpperCase() }}</span>
        <span>{{ formData.requestList.length }} 请求</span>
        <span>{{ formData.vulnerabilityList.length }} 漏洞</span>
      </div>
      <button
        class="dialog-close"
        type="button"
        aria-label="关闭"
        :disabled="saving"
        @click="handleClose"
      >
        <el-icon><Icon :icon="iconMap.close" /></el-icon>
      </button>
    </header>

    <el-form
      ref="formRef"
      :model="formData"
      :rules="formRules"
      label-position="top"
      class="fingerprint-form"
    >
      <section class="form-section">
        <div class="section-heading">
          <span>Identity</span><strong>基础信息</strong>
        </div>
        <div class="base-grid">
          <el-form-item
            v-if="isEdit && formData.fingerprintId"
            label="当前指纹ID"
            class="span-full"
          >
            <span class="readonly-fingerprint-id">{{ formData.fingerprintId }}</span>
            <div class="form-tip">
              由 name + version 自动生成，同名同版本会覆盖
            </div>
          </el-form-item>
          <el-form-item
            label="协议"
            prop="protocol"
            required
          >
            <el-select
              v-model="formData.protocol"
              placeholder="请选择"
              style="width: 100%"
            >
              <el-option
                label="HTTP"
                value="http"
              />
              <el-option
                label="TCP"
                value="tcp"
              />
            </el-select>
          </el-form-item>
          <el-form-item
            label="名称"
            prop="name"
            required
          >
            <el-input
              v-model="formData.name"
              placeholder="指纹名称，参与生成 fingerprintId"
              clearable
            />
          </el-form-item>
          <el-form-item
            label="版本"
            prop="version"
            required
          >
            <el-input
              v-model="formData.version"
              placeholder="如：1.0"
              clearable
            />
            <div class="form-tip">
              与名称一起决定指纹ID（name_version），同名同版本会覆盖原文件
            </div>
          </el-form-item>
          <el-form-item
            label="标签"
            prop="tagsStr"
          >
            <el-input
              v-model="formData.tagsStr"
              placeholder="多个标签用英文逗号分隔，如：http,web-app,java"
              clearable
            />
          </el-form-item>
          <el-form-item
            label="作者"
            prop="infoAuthor"
          >
            <el-input
              v-model="formData.infoAuthor"
              placeholder="可选"
              clearable
            />
          </el-form-item>
          <el-form-item
            label="备注"
            prop="infoRemark"
          >
            <el-input
              v-model="formData.infoRemark"
              placeholder="可选"
              clearable
            />
          </el-form-item>
        </div>
      </section>

      <section class="form-section">
        <div class="section-heading">
          <span>Risk Intelligence</span><strong>已知漏洞</strong>
        </div>
        <el-form-item>
          <FingerprintVulnerabilityEditor v-model="formData.vulnerabilityList" />
          <div class="form-tip">
            可选。命中后会展示给操作员并供 AI 漏洞推荐使用，没有已知漏洞可留空。
          </div>
        </el-form-item>
      </section>

      <section class="form-section">
        <div class="section-heading">
          <span>Detection Rule</span><strong>请求与命中</strong>
        </div>
        <el-form-item
          label="请求列表"
          required
        >
          <FingerprintRequestEditor
            v-model="formData.requestList"
            :protocol="formData.protocol"
          />
          <div class="form-tip">
            按顺序执行，至少保留一条请求
          </div>
        </el-form-item>
        <el-form-item
          label="命中脚本"
          prop="script"
          required
        >
          <el-input
            v-model="formData.script"
            type="textarea"
            placeholder="JavaScript：HTTP 可用 resp[i].status、resp[i].body、resp[i].headers；TCP 可用 raw 或 resp[i].raw"
            :rows="4"
            clearable
          />
        </el-form-item>
      </section>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <span>{{ formData.requestList.length }} 个请求 · {{ formData.vulnerabilityList.length }} 条漏洞</span>
        <div class="footer-actions">
          <el-button
            :disabled="saving"
            @click="handleClose"
          >
            取消
          </el-button>
          <el-button
            type="primary"
            :loading="saving"
            :disabled="saving"
            @click="handleSubmit"
          >
            保存
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { icons } from '@/utils/icons.js'
import { showWarning } from '@/utils/messageUtils.js'
import { useDialogVisible } from '@/composables/useDialogVisible.js'
import FingerprintRequestEditor from './FingerprintRequestEditor.vue'
import FingerprintVulnerabilityEditor from './FingerprintVulnerabilityEditor.vue'
import {
  buildFingerprintPayload,
  createEmptyFingerprintForm,
  findIncompleteVulnerabilities,
  loadFingerprintForm,
  normalizeRequestsForProtocol
} from './saveFingerprintModel.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  fingerprint: { type: Object, default: null },
  loading: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'submit'])
const visible = useDialogVisible(props, emit)
const iconMap = icons
const formRef = ref(null)
const formData = ref(createEmptyFingerprintForm())
const submitLocked = ref(false)
const isEdit = computed(() => Boolean(props.fingerprint))
const saving = computed(() => props.loading || submitLocked.value)

const formRules = {
  protocol: [{ required: true, message: '请选择协议', trigger: 'change' }],
  name: [{ required: true, message: '请输入指纹名称', trigger: 'blur' }],
  version: [{ required: true, message: '请输入版本', trigger: 'blur' }],
  script: [{ required: true, message: '请输入命中判断脚本', trigger: 'blur' }]
}

watch(
  () => [props.modelValue, props.fingerprint],
  ([isVisible]) => {
    if (!isVisible) return
    submitLocked.value = false
    formData.value = loadFingerprintForm(props.fingerprint)
    formRef.value?.clearValidate()
  },
  { immediate: true }
)

watch(
  () => formData.value.protocol,
  (protocol, previousProtocol) => {
    if (!previousProtocol || protocol === previousProtocol) return
    formData.value.requestList = normalizeRequestsForProtocol(formData.value.requestList, protocol)
    formRef.value?.clearValidate()
  }
)

watch(
  () => props.loading,
  (loading, wasLoading) => {
    if (!loading && wasLoading) submitLocked.value = false
  }
)

const handleClose = () => {
  if (!saving.value) visible.value = false
}

const handleClosed = () => {
  submitLocked.value = false
  formData.value = createEmptyFingerprintForm()
  formRef.value?.clearValidate()
}

const handleSubmit = async () => {
  if (!formRef.value || saving.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  if (!formData.value.requestList.length) {
    showWarning('请至少添加一条请求')
    return
  }
  const incompleteCount = findIncompleteVulnerabilities(formData.value.vulnerabilityList).length
  if (incompleteCount) {
    showWarning(`有 ${incompleteCount} 条漏洞缺少标题，请补全或删除`)
    return
  }
  submitLocked.value = true
  emit('submit', buildFingerprintPayload(formData.value))
}
</script>

<style scoped>
.fingerprint-dialog {
  --fp-surface: color-mix(in srgb, var(--app-control-background-soft) 88%, var(--el-bg-color-overlay));
  --fp-surface-strong: color-mix(in srgb, var(--app-card-background) 88%, transparent);
  --fp-border: color-mix(in srgb, var(--el-border-color) 28%, transparent);
}

:global(.el-dialog.fingerprint-dialog > .el-dialog__header) {
  display: none;
  padding: 0;
}

:global(.el-dialog.fingerprint-dialog) {
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: var(--radius-overlay);
}

:global(.el-dialog.fingerprint-dialog > .el-dialog__body) {
  flex: 1;
  min-height: 0;
  padding: 0;
  overflow: hidden;
}

:global(.el-dialog.fingerprint-dialog > .el-dialog__footer) {
  padding: 0;
}

.dialog-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 28px;
  align-items: center;
  gap: 14px;
  min-height: 48px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--fp-border);
  background: var(--fp-surface);
}

.dialog-title-block { min-width: 0; }

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

.dialog-close:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--el-color-primary) 24%, transparent);
  background: color-mix(in srgb, var(--el-color-primary) 7%, transparent);
  color: var(--el-color-primary);
}

.dialog-close:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.fingerprint-form {
  height: min(680px, calc(86vh - 100px));
  padding: 12px 14px;
  overflow: auto;
}

.fingerprint-form :deep(.el-form-item) {
  margin-bottom: 10px;
}

.fingerprint-form :deep(.el-form-item__label) {
  padding-bottom: 4px;
  color: var(--el-text-color-primary);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.25;
}

.form-section {
  padding: 12px;
  border: 1px solid var(--fp-border);
  border-radius: 8px;
  background: var(--fp-surface-strong);
}

.form-section + .form-section {
  margin-top: 10px;
}

.section-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.section-heading span {
  color: var(--el-text-color-placeholder);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.section-heading strong {
  color: var(--el-text-color-primary);
  font-size: 13px;
}

.base-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 12px;
}

.span-full {
  grid-column: 1 / -1;
}

.dialog-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 48px;
  padding: 8px 14px;
  border-top: 1px solid var(--fp-border);
  background: var(--fp-surface);
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.footer-actions {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.form-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

.readonly-fingerprint-id {
  font-family: var(--el-font-family-mono);
  color: var(--el-text-color-regular);
}

@media (max-width: 760px) {
  :global(.el-dialog.fingerprint-dialog) {
    width: calc(100vw - 16px) !important;
    margin: 8px auto;
  }

  .dialog-header {
    grid-template-columns: minmax(0, 1fr) 28px;
  }

  .dialog-meta {
    grid-column: 1 / -1;
    justify-content: flex-start;
  }

  .base-grid {
    grid-template-columns: 1fr;
  }

  .dialog-footer {
    align-items: stretch;
    flex-direction: column;
  }

  .footer-actions {
    justify-content: flex-end;
    margin-left: 0;
  }
}
</style>
