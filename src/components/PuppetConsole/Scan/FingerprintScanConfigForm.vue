<template>
  <div class="cfg-form scan-config-surface">
    <el-form
      ref="formRef"
      :model="form"
      :rules="formRules"
    >
      <!-- 指纹选择 -->
      <div class="cfg-section cfg-section--rules">
        <div class="cfg-section-label">
          指纹规则
        </div>
        <el-form-item
          prop="fingerprintIds"
          class="cfg-field-bare"
        >
          <el-select
            v-model="form.fingerprintIds"
            :placeholder="fingerprintPlaceholder"
            filterable
            multiple
            collapse-tags
            collapse-tags-tooltip
            style="width: 100%"
            @change="onFingerprintChange"
          >
            <el-option
              v-for="fp in fingerprintOptions"
              :key="fp.fingerprintId"
              :label="fp.name || fp.fingerprintId"
              :value="fp.fingerprintId"
            >
              <span>{{ fp.name || fp.fingerprintId }}</span>
            </el-option>
          </el-select>
        </el-form-item>
        <div class="cfg-hint">
          {{ formTip }}；多选时批量启动任务（同一批目标）
        </div>
      </div>

      <div class="cfg-divider" />

      <!-- 扫描目标 -->
      <div class="cfg-section cfg-section--targets">
        <div class="cfg-section-label">
          {{ targetLabel }}
        </div>

        <div class="targets-list">
          <!-- HTTP 目标 -->
          <template v-if="isHttp">
            <div
              v-for="(t, i) in form.targetsHttp"
              :key="i"
              class="target-row"
            >
              <el-input
                v-model="t.baseUrl"
                placeholder="http(s)://host:port"
                size="small"
                clearable
                class="target-url-input"
              />
              <el-button
                type="danger"
                link
                size="small"
                @click="removeTarget(i)"
              >
                删除
              </el-button>
            </div>
          </template>

          <!-- TCP 目标 -->
          <template v-else>
            <div
              v-for="(t, i) in form.targetsTcp"
              :key="i"
              class="target-row"
            >
              <el-input
                v-model="t.host"
                placeholder="IP 或域名"
                size="small"
                class="target-host"
              />
              <el-input-number
                v-model="t.port"
                :min="1"
                :max="65535"
                size="small"
                class="target-port"
              />
              <el-button
                type="danger"
                link
                size="small"
                @click="removeTarget(i)"
              >
                删除
              </el-button>
            </div>
          </template>

          <!-- 操作行 -->
          <div class="target-actions">
            <button
              type="button"
              class="target-add-btn"
              @click="addTarget"
            >
              + 添加目标
            </button>
            <button
              type="button"
              class="target-batch-btn"
              :class="{ 'is-active': batchInputVisible }"
              @click="batchInputVisible = !batchInputVisible"
            >
              {{ batchInputVisible ? '收起批量' : '批量输入' }}
            </button>
          </div>

          <!-- 批量输入 -->
          <div
            v-show="batchInputVisible"
            class="batch-input-area"
          >
            <el-input
              v-model="batchInputText"
              type="textarea"
              :placeholder="batchInputPlaceholder"
              :rows="4"
              resize="none"
              class="batch-textarea"
            />
            <div class="cfg-hint">
              {{ batchInputTip }}
            </div>
            <el-button
              type="primary"
              size="small"
              style="margin-top: 6px"
              @click="applyBatchInput"
            >
              解析并填入
            </el-button>
          </div>
        </div>
      </div>

      <div class="cfg-divider" />

      <!-- 线程数 -->
      <div class="cfg-section cfg-section--threads">
        <div class="cfg-section-label">
          线程数
        </div>
        <div class="inline-ctrl">
          <el-input-number
            v-model="form.threads"
            :min="1"
            :max="200"
            controls-position="right"
            class="ctrl-input"
          />
          <span class="ctrl-unit">threads</span>
        </div>
        <div class="cfg-hint">
          并发扫描的线程数
        </div>
      </div>
    </el-form>

    <div class="cfg-actions">
      <el-button
        type="primary"
        :loading="isStarting"
        :disabled="!canStart"
        class="action-btn"
        @click="handleStart"
      >
        <el-icon><Icon :icon="iconMap.play" /></el-icon>
        {{ form.fingerprintIds.length > 1 ? `开始扫描 (${form.fingerprintIds.length} 个任务)` : '开始扫描' }}
      </el-button>
      <el-button
        class="action-btn action-btn-ghost"
        @click="handleReset"
      >
        重置
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { icons } from '@/utils/icons.js'
import { getFingerprintsByProtocolApi } from '@/services/api.js'
import { showSuccess, showWarning } from '@/utils/messageUtils.js'

const iconMap = icons

const props = defineProps({
  protocol: {
    type: String,
    required: true,
    validator: (v) => ['tcp', 'http'].includes((v || '').toLowerCase())
  },
  isStarting: {
    type: Boolean,
    default: false
  },
  initialTargets: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['start-scan', 'initial-targets-applied'])

const formRef = ref(null)
const fingerprints = ref([])
const batchInputVisible = ref(false)
const batchInputText = ref('')
const form = ref({
  fingerprintIds: [],
  targetsHttp: [{ baseUrl: '' }],
  targetsTcp: [{ host: '', port: 8080 }],
  threads: 10
})

const protocolLower = computed(() => (props.protocol || '').toLowerCase())
const isHttp = computed(() => protocolLower.value === 'http')
const fingerprintPlaceholder = computed(() => isHttp.value ? '选择 HTTP 指纹' : '选择 TCP 指纹')
const formTip = computed(() =>
  isHttp.value ? '填写 HTTP baseUrl，如 http://192.168.1.1:80' : '填写目标 host 与 port'
)
const targetLabel = computed(() => isHttp.value ? 'HTTP 目标 (baseUrl)' : 'TCP 目标 (host:port)')
const batchInputPlaceholder = computed(() =>
  isHttp.value
    ? '每行一个 HTTP 地址，例如：\nhttp://192.168.1.1:80\nhttps://example.com'
    : '每行一个目标，支持 host:port 或 host 端口（默认8080），例如：\n192.168.1.1:80\n10.0.0.1 443'
)
const batchInputTip = computed(() =>
  isHttp.value
    ? '每行一个 URL，空行会被忽略'
    : '每行一个目标，支持 192.168.1.1:80 或 192.168.1.1 空格 80，仅 host 时端口默认 8080'
)

const fingerprintOptions = computed(() => fingerprints.value || [])
const formRules = {
  fingerprintIds: [
    { type: 'array', required: true, min: 1, message: '请至少选择一个指纹', trigger: 'change' }
  ],
  threads: [{ required: true, message: '请输入线程数', trigger: 'blur' }]
}

function addTarget() {
  if (isHttp.value) form.value.targetsHttp.push({ baseUrl: '' })
  else form.value.targetsTcp.push({ host: '', port: 8080 })
}

function removeTarget(index) {
  if (isHttp.value) {
    form.value.targetsHttp.splice(index, 1)
    if (form.value.targetsHttp.length === 0) form.value.targetsHttp.push({ baseUrl: '' })
  } else {
    form.value.targetsTcp.splice(index, 1)
    if (form.value.targetsTcp.length === 0) form.value.targetsTcp.push({ host: '', port: 8080 })
  }
}

function onFingerprintChange() {
  if (!form.value.fingerprintIds?.length) return
  if (isHttp.value) {
    if (!form.value.targetsHttp?.length) form.value.targetsHttp = [{ baseUrl: '' }]
  } else {
    if (!form.value.targetsTcp?.length) form.value.targetsTcp = [{ host: '', port: 8080 }]
  }
}

const DEFAULT_TCP_PORT = 8080

function parseTcpLine(line) {
  const s = String(line).trim()
  if (!s) return null
  const colon = s.indexOf(':')
  const space = s.indexOf(' ')
  if (colon !== -1) {
    const host = s.slice(0, colon).trim()
    const port = parseInt(s.slice(colon + 1).trim(), 10)
    if (!host || !Number.isInteger(port) || port < 1 || port > 65535) return null
    return { host, port }
  }
  if (space !== -1) {
    const host = s.slice(0, space).trim()
    const port = parseInt(s.slice(space + 1).trim(), 10)
    if (!host || !Number.isInteger(port) || port < 1 || port > 65535) return null
    return { host, port }
  }
  return { host: s, port: DEFAULT_TCP_PORT }
}

function applyBatchInput() {
  const text = batchInputText.value || ''
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) { showWarning('请输入至少一行目标'); return }
  if (isHttp.value) {
    const list = lines.map((url) => ({ baseUrl: url }))
    form.value.targetsHttp = list
    showSuccess(`已填入 ${list.length} 个 HTTP 目标`)
  } else {
    const list = []
    const invalid = []
    for (const line of lines) {
      const t = parseTcpLine(line)
      if (t) list.push(t)
      else invalid.push(line)
    }
    if (list.length === 0) { showWarning('未能解析出有效 TCP 目标，请使用 host:port 或 host 端口 格式'); return }
    form.value.targetsTcp = list
    if (invalid.length) showWarning(`已填入 ${list.length} 个目标，${invalid.length} 行格式无效已忽略`)
    else showSuccess(`已填入 ${list.length} 个 TCP 目标`)
  }
  batchInputText.value = ''
}

function buildTargets() {
  if (isHttp.value) {
    return form.value.targetsHttp
      .filter((t) => t.baseUrl != null && String(t.baseUrl).trim())
      .map((t) => ({ protocol: 'http', baseUrl: String(t.baseUrl).trim() }))
  }
  return form.value.targetsTcp
    .filter((t) => t.host != null && String(t.host).trim() && t.port != null)
    .map((t) => ({ protocol: 'tcp', host: String(t.host).trim(), port: Number(t.port) }))
}

const canStart = computed(() => {
  if (!form.value.fingerprintIds?.length) return false
  return buildTargets().length > 0 && form.value.threads >= 1
})

function handleStart() {
  formRef.value?.validate((valid) => {
    if (!valid) return
    const targets = buildTargets()
    if (targets.length === 0) {
      showWarning(isHttp.value ? '请至少填写一个 HTTP baseUrl' : '请至少填写一个 TCP host:port')
      return
    }
    emit('start-scan', {
      fingerprintIds: [...(form.value.fingerprintIds || [])],
      targets,
      threads: form.value.threads,
      protocol: protocolLower.value
    })
  })
}

function handleReset() {
  form.value = {
    fingerprintIds: [],
    targetsHttp: [{ baseUrl: '' }],
    targetsTcp: [{ host: '', port: 8080 }],
    threads: 10
  }
  formRef.value?.clearValidate()
}

async function loadFingerprints() {
  const protocol = protocolLower.value
  if (!protocol) return
  try {
    const res = await getFingerprintsByProtocolApi({ protocol })
    const list = res.data ?? []
    fingerprints.value = Array.isArray(list) ? list : []
    const validIds = new Set((fingerprints.value || []).map((f) => f.fingerprintId))
    if (form.value.fingerprintIds?.length) {
      form.value.fingerprintIds = form.value.fingerprintIds.filter((id) => validIds.has(id))
    }
  } catch {
    fingerprints.value = []
  }
}

onMounted(loadFingerprints)
watch(() => props.protocol, loadFingerprints)

watch(
  () => props.initialTargets,
  (targets) => {
    if (protocolLower.value !== 'tcp' || !targets?.length) return
    form.value.targetsTcp = targets.map((t) => ({
      host: t.host ?? '',
      port: Number(t.port) || 8080
    }))
    emit('initial-targets-applied')
  },
  { immediate: true }
)
</script>

<style scoped>
/* ── 表单容器 ─────────────────────────────────────────────────────────── */
.cfg-form {
  display: flex;
  flex-direction: column;
  gap: 0;
  height: auto;
  container-name: scan-config;
  container-type: inline-size;
}

/* ── 分组 ─────────────────────────────────────────────────────────────── */
.cfg-section {
  padding: 10px 0 8px;
}

.cfg-section-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--el-text-color-secondary);
  margin-bottom: 10px;
}

.cfg-divider {
  height: 1px;
  background: color-mix(in srgb, var(--el-border-color) 22%, transparent);
  margin: 0;
}

/* ── 字段 ─────────────────────────────────────────────────────────────── */
.cfg-field-bare {
  margin-bottom: 0;
}

.cfg-field-bare :deep(.el-form-item__content) {
  display: block;
}

.cfg-field-bare :deep(.el-select__wrapper) {
  border-radius: var(--radius-control);
}

/* ── 提示文字 ─────────────────────────────────────────────────────────── */
.cfg-hint {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  margin-top: 6px;
  line-height: 1.5;
}

/* ── 目标列表 ─────────────────────────────────────────────────────────── */
.targets-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.target-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.target-url-input,
.target-host {
  flex: 1;
  min-width: 0;
}

.target-port {
  flex: 0 0 96px;
  min-width: 0;
}

/* 让 input 圆角统一，不覆盖 box-shadow（保留 Element Plus 原生聚焦效果） */
.target-row :deep(.el-input__wrapper),
.target-row :deep(.el-input-number .el-input__wrapper) {
  border-radius: var(--radius-control);
}

/* 删除按钮用小图标圆形按钮 */
.target-row :deep(.el-button.is-link) {
  width: 24px;
  height: 24px;
  padding: 0;
  border-radius: 6px;
  flex-shrink: 0;
  color: var(--el-text-color-placeholder);
  transition: color 0.15s, background 0.15s;
}

.target-row :deep(.el-button.is-link:hover) {
  color: var(--el-color-danger);
  background: color-mix(in srgb, var(--el-color-danger) 8%, transparent);
}

/* ── 目标操作按钮 ──────────────────────────────────────────────────────── */
.target-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-top: 2px;
  flex-wrap: wrap;
}

.target-add-btn,
.target-batch-btn {
  height: 26px;
  padding: 0 12px;
  border: 1px solid var(--el-border-color);
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--el-text-color-regular);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  line-height: 1;
  white-space: nowrap;
}

.target-add-btn:hover {
  border-color: var(--el-color-primary-light-5);
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 6%, transparent);
}

.target-batch-btn:hover {
  border-color: var(--el-border-color-dark);
  color: var(--el-text-color-primary);
  background: var(--el-fill-color);
}

.target-batch-btn.is-active {
  border-color: var(--el-color-primary-light-5);
  background: color-mix(in srgb, var(--el-color-primary) 8%, transparent);
  color: var(--el-color-primary);
}

/* ── 批量输入 ─────────────────────────────────────────────────────────── */
.batch-input-area {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  border-radius: var(--radius-control);
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
}

.batch-textarea :deep(.el-textarea__inner) {
  border-radius: 7px;
  font-size: 12px;
  font-family: var(--el-font-family-mono);
  resize: none;
  background: var(--el-fill-color-blank);
}

/* ── 内联控件 ─────────────────────────────────────────────────────────── */
.inline-ctrl {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ctrl-input {
  flex: 1;
  min-width: 0;
}

.ctrl-input :deep(.el-input__wrapper) {
  border-radius: var(--radius-control);
}

.ctrl-unit {
  font-size: var(--el-font-size-small);
  font-weight: 600;
  color: var(--el-text-color-regular);
  flex-shrink: 0;
}

/* ── 操作按钮行 ──────────────────────────────────────────────────────── */
.cfg-actions {
  display: flex;
  gap: 8px;
  padding: 12px 0 2px;
  margin-top: 0;
}

.action-btn {
  flex: 1;
  height: 36px;
  border-radius: var(--radius-control);
  font-weight: 600;
}

.action-btn-ghost {
  flex: none;
  min-width: 72px;
}

@container scan-config (min-width: 700px) {
  .cfg-form > :deep(.el-form) {
    display: grid;
    grid-template-columns: minmax(280px, 0.8fr) minmax(0, 1.35fr);
    grid-template-rows: auto auto;
    align-items: start;
    column-gap: 20px;
  }

  .cfg-form > :deep(.el-form) > .cfg-divider {
    display: none;
  }

  .cfg-section--rules {
    grid-column: 1;
    grid-row: 1;
  }

  .cfg-section--threads {
    grid-column: 1;
    grid-row: 2;
  }

  .cfg-section--targets {
    grid-column: 2;
    grid-row: 1 / span 2;
  }

  .cfg-actions {
    justify-content: flex-end;
    padding-top: 8px;
  }

  .action-btn {
    flex: 0 0 240px;
  }

  .action-btn-ghost {
    flex: 0 0 72px;
  }
}

@media (max-width: 900px) {
  .target-row {
    flex-wrap: wrap;
  }

  .target-host,
  .target-port {
    flex-basis: 100%;
  }
}
</style>
