<template>
  <div class="recon-workspace">
    <!-- 左侧：配置面板 -->
    <section class="workspace-section">
      <header class="section-heading">
        <div>
          <strong>侦察扫描配置</strong>
          <span>组合规则过滤器并投递多协议目标</span>
        </div>
        <span class="section-step">01</span>
      </header>
      <div class="cfg-form scan-config-surface">
        <el-form
          ref="formRef"
          :model="form"
        >
          <!-- 规则选择器 -->
          <div class="cfg-section cfg-section--rules">
            <div class="cfg-section-label">
              规则选择器
            </div>

            <div class="cfg-subsection-label">
              协议过滤
            </div>
            <el-radio-group
              v-model="form.selectorProtocol"
              class="cfg-radio-group"
            >
              <el-radio-button value="">
                全部
              </el-radio-button>
              <el-radio-button value="http">
                HTTP
              </el-radio-button>
              <el-radio-button value="tcp">
                TCP
              </el-radio-button>
            </el-radio-group>
            <div class="cfg-hint">
              限定只使用该协议的指纹规则；"全部"则两类规则均会被选入
            </div>

            <div
              class="cfg-subsection-label"
              style="margin-top: 12px;"
            >
              标签过滤 <span class="cfg-tag-or">OR</span>
            </div>
            <el-select
              v-model="form.selectorTags"
              multiple
              filterable
              allow-create
              collapse-tags
              collapse-tags-tooltip
              placeholder="选择或输入标签，留空则不过滤"
              style="width: 100%"
            >
              <el-option
                v-for="tag in allTags"
                :key="tag"
                :label="tag"
                :value="tag"
              />
            </el-select>
            <div class="cfg-hint">
              只选中含有任意一个所选标签的规则（OR）；不填则不过滤标签
            </div>

            <div
              class="cfg-subsection-label"
              style="margin-top: 12px;"
            >
              指定规则 ID
            </div>
            <el-select
              v-model="form.selectorFingerprintIds"
              multiple
              filterable
              collapse-tags
              collapse-tags-tooltip
              placeholder="不填则按协议/标签自动筛选"
              style="width: 100%"
            >
              <el-option
                v-for="fp in allFingerprints"
                :key="fp.fingerprintId"
                :label="`${fp.name || fp.fingerprintId} (${fp.protocol})`"
                :value="fp.fingerprintId"
              />
            </el-select>
            <div class="cfg-hint">
              精确指定时优先于协议/标签过滤
            </div>
          </div>

          <div class="cfg-divider" />

          <!-- 扫描目标 -->
          <div class="cfg-section cfg-section--targets">
            <div class="cfg-section-label">
              扫描目标
            </div>

            <!-- HTTP 目标 -->
            <div class="cfg-subsection-label">
              HTTP 目标 (baseUrl)
              <span class="target-count">{{ form.targetsHttp.length }} 个</span>
            </div>
            <div class="targets-list">
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
                  @click="removeHttpTarget(i)"
                >
                  删除
                </el-button>
              </div>
              <div class="target-actions">
                <button
                  type="button"
                  class="target-add-btn"
                  @click="addHttpTarget"
                >
                  + 添加
                </button>
                <button
                  type="button"
                  class="target-batch-btn"
                  :class="{ 'is-active': httpBatchVisible }"
                  @click="httpBatchVisible = !httpBatchVisible"
                >
                  {{ httpBatchVisible ? '收起批量' : '批量输入' }}
                </button>
              </div>
              <div
                v-show="httpBatchVisible"
                class="batch-input-area"
              >
                <el-input
                  v-model="httpBatchText"
                  type="textarea"
                  placeholder="每行一个，例如：&#10;http://192.168.1.100:8080&#10;https://192.168.1.101"
                  :rows="3"
                  resize="none"
                  class="batch-textarea"
                />
                <el-button
                  type="primary"
                  size="small"
                  style="margin-top: 6px"
                  @click="applyHttpBatch"
                >
                  解析并填入
                </el-button>
              </div>
            </div>

            <!-- TCP 目标 -->
            <div
              class="cfg-subsection-label"
              style="margin-top: 12px;"
            >
              TCP 目标 (host:port)
              <span class="target-count">{{ form.targetsTcp.length }} 个</span>
            </div>
            <div class="targets-list">
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
                  @click="removeTcpTarget(i)"
                >
                  删除
                </el-button>
              </div>
              <div class="target-actions">
                <button
                  type="button"
                  class="target-add-btn"
                  @click="addTcpTarget"
                >
                  + 添加
                </button>
                <button
                  type="button"
                  class="target-batch-btn"
                  :class="{ 'is-active': tcpBatchVisible }"
                  @click="tcpBatchVisible = !tcpBatchVisible"
                >
                  {{ tcpBatchVisible ? '收起批量' : '批量输入' }}
                </button>
              </div>
              <div
                v-show="tcpBatchVisible"
                class="batch-input-area"
              >
                <el-input
                  v-model="tcpBatchText"
                  type="textarea"
                  placeholder="每行一个 host:port，例如：&#10;192.168.1.100:3306&#10;192.168.1.101:22"
                  :rows="3"
                  resize="none"
                  class="batch-textarea"
                />
                <el-button
                  type="primary"
                  size="small"
                  style="margin-top: 6px"
                  @click="applyTcpBatch"
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
              并发 (target × rule) 对数
            </div>
          </div>
        </el-form>

        <div class="cfg-actions">
          <el-button
            type="primary"
            :loading="isStarting"
            :disabled="totalTargets === 0"
            class="action-btn"
            @click="handleStart"
          >
            <el-icon><Icon :icon="iconMap.play" /></el-icon>
            开始侦察扫描
          </el-button>
          <el-button
            class="action-btn action-btn-ghost"
            @click="handleReset"
          >
            重置
          </el-button>
        </div>
      </div>
    </section>

    <!-- 右侧：任务列表 -->
    <section class="workspace-section">
      <header class="section-heading">
        <div>
          <strong>侦察任务</strong>
          <span>汇总目标与指纹规则命中情况</span>
        </div>
        <span class="section-step">02</span>
      </header>
      <ReconScanTaskList
        :tasks="tasks"
        :is-refreshing="isRefreshing"
        @refresh="refresh"
        @query="queryResult"
        @remove="remove"
        @batch-remove="batchRemove"
        @pause="pause"
        @resume="resume"
        @stop="stop"
      />
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, toRef } from 'vue'
import { Icon } from '@iconify/vue'
import { icons } from '@/utils/icons.js'
import { getFingerprintsApi } from '@/services/api.js'
import { useReconScan } from '@/composables/useReconScan.js'
import ReconScanTaskList from './ReconScanTaskList.vue'

const iconMap = icons

const props = defineProps({
  sessionId: {
    type: String,
    required: true
  }
})

const sessionIdRef = toRef(props, 'sessionId')

const {
  tasks,
  isStarting,
  isRefreshing,
  startScan,
  queryResult,
  remove,
  batchRemove,
  refresh,
  pause,
  resume,
  stop
} = useReconScan(sessionIdRef)

// ── 指纹列表（用于标签/ID 下拉）────────────────────────────────────────────
const allFingerprints = ref([])
const allTags = computed(() => {
  const tagSet = new Set()
  for (const fp of allFingerprints.value) {
    const tags = fp.tags
    if (Array.isArray(tags)) tags.forEach((t) => tagSet.add(t))
  }
  return Array.from(tagSet).sort()
})

onMounted(async () => {
  try {
    const res = await getFingerprintsApi()
    allFingerprints.value = res?.data ?? []
  } catch { /* ignore */ }
})

// ── 表单状态 ──────────────────────────────────────────────────────────────
const formRef = ref(null)
const form = ref({
  selectorProtocol: '',
  selectorTags: [],
  selectorFingerprintIds: [],
  targetsHttp: [],
  targetsTcp: [],
  threads: 20
})

const httpBatchVisible = ref(false)
const tcpBatchVisible = ref(false)
const httpBatchText = ref('')
const tcpBatchText = ref('')

const totalTargets = computed(() => form.value.targetsHttp.length + form.value.targetsTcp.length)

// ── HTTP 目标操作 ─────────────────────────────────────────────────────────
function addHttpTarget() {
  form.value.targetsHttp.push({ protocol: 'http', baseUrl: '' })
}

function removeHttpTarget(i) {
  form.value.targetsHttp.splice(i, 1)
}

function applyHttpBatch() {
  const lines = httpBatchText.value.split('\n').map((l) => l.trim()).filter(Boolean)
  for (const line of lines) {
    const url = line.startsWith('http') ? line : `http://${line}`
    form.value.targetsHttp.push({ protocol: 'http', baseUrl: url })
  }
  httpBatchText.value = ''
  httpBatchVisible.value = false
}

// ── TCP 目标操作 ──────────────────────────────────────────────────────────
function addTcpTarget() {
  form.value.targetsTcp.push({ protocol: 'tcp', host: '', port: 80 })
}

function removeTcpTarget(i) {
  form.value.targetsTcp.splice(i, 1)
}

function applyTcpBatch() {
  const lines = tcpBatchText.value.split('\n').map((l) => l.trim()).filter(Boolean)
  for (const line of lines) {
    const parts = line.split(':')
    const host = parts[0]
    const port = parts[1] ? parseInt(parts[1]) : 80
    if (host) {
      form.value.targetsTcp.push({ protocol: 'tcp', host, port: isNaN(port) ? 80 : port })
    }
  }
  tcpBatchText.value = ''
  tcpBatchVisible.value = false
}

// ── 启动 & 重置 ───────────────────────────────────────────────────────────
function handleStart() {
  const httpTargets = form.value.targetsHttp
    .filter((t) => t.baseUrl && t.baseUrl.trim())
    .map((t) => ({ protocol: 'http', baseUrl: t.baseUrl.trim() }))

  const tcpTargets = form.value.targetsTcp
    .filter((t) => t.host && t.host.trim() && t.port > 0)
    .map((t) => ({ protocol: 'tcp', host: t.host.trim(), port: t.port }))

  const targets = [...httpTargets, ...tcpTargets]

  const ruleSelector = {}
  if (form.value.selectorFingerprintIds.length > 0) {
    ruleSelector.fingerprintIds = form.value.selectorFingerprintIds.slice()
  } else {
    if (form.value.selectorProtocol) ruleSelector.protocol = form.value.selectorProtocol
    if (form.value.selectorTags.length > 0) ruleSelector.tags = form.value.selectorTags.slice()
  }

  startScan({
    targets,
    ruleSelector,
    threads: form.value.threads
  })
}

function handleReset() {
  form.value.selectorProtocol = ''
  form.value.selectorTags = []
  form.value.selectorFingerprintIds = []
  form.value.targetsHttp = []
  form.value.targetsTcp = []
  form.value.threads = 20
  httpBatchText.value = ''
  tcpBatchText.value = ''
  httpBatchVisible.value = false
  tcpBatchVisible.value = false
}

defineExpose({ tasks, queryResult, remove, batchRemove, refresh, pause, resume, stop })
</script>

<style scoped>
/* ── 布局 ─────────────────────────────────────────────────────────────── */
.recon-workspace {
  --scan-section-border: color-mix(in srgb, var(--el-border-color) 16%, transparent);
  display: grid;
  grid-template-columns: minmax(400px, 0.82fr) minmax(0, 1.18fr);
  grid-template-rows: minmax(0, 1fr);
  gap: 0;
  min-height: 0;
  height: 100%;
  background: var(--app-page-background);
}

.workspace-section {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 10px 12px;
  overflow: auto;
  background: var(--app-page-background);
}

.workspace-section + .workspace-section {
  border-top: 0;
  border-left: 1px solid var(--scan-section-border);
}

.workspace-section:first-child {
  align-self: stretch;
  height: 100%;
  max-height: none;
  border-bottom: 1px solid var(--scan-section-border);
  background: var(--app-page-background);
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: -10px -12px 4px;
  min-height: 48px;
  padding: 7px 12px;
  border-bottom: 1px solid var(--scan-section-border);
  background: color-mix(in srgb, var(--app-control-background-soft) 72%, var(--app-card-background));
}

.section-heading > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.section-heading strong {
  font-size: 13px;
  font-weight: 650;
  color: var(--el-text-color-primary);
}

.section-heading span {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.section-step {
  font-family: var(--app-font-mono, monospace);
  color: color-mix(in srgb, var(--el-color-primary) 60%, var(--el-text-color-placeholder)) !important;
  font-weight: 700;
}

/* ── 表单容器 ─────────────────────────────────────────────────────────── */
.cfg-form {
  display: flex;
  flex-direction: column;
  gap: 0;
  height: auto;
  overflow: visible;
  min-height: 0;
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

.cfg-subsection-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-regular);
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.cfg-tag-or {
  display: inline-flex;
  align-items: center;
  height: 16px;
  padding: 0 5px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--el-color-primary) 12%, transparent);
  color: var(--el-color-primary);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.target-count {
  margin-left: auto;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  font-weight: 400;
}

.cfg-divider {
  height: 1px;
  background: color-mix(in srgb, var(--el-border-color) 22%, transparent);
  margin: 0;
}

/* ── El-Select 圆角 ───────────────────────────────────────────────────── */
.cfg-form :deep(.el-select__wrapper) {
  border-radius: 8px;
}

/* ── 提示文字 ─────────────────────────────────────────────────────────── */
.cfg-hint {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  margin-top: 6px;
  line-height: 1.5;
}

/* ── 协议单选组 ───────────────────────────────────────────────────────── */
.cfg-radio-group {
  width: 100%;
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

.target-row :deep(.el-input__wrapper),
.target-row :deep(.el-input-number .el-input__wrapper) {
  border-radius: 8px;
}

/* 删除按钮 */
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
  border-radius: 999px;
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
  border-radius: 8px;
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
  border-radius: 8px;
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
  border-radius: 8px;
  font-weight: 600;
}

.action-btn-ghost {
  flex: none;
  min-width: 72px;
}

@media (min-width: 1800px) {
  .cfg-form > :deep(.el-form) {
    display: grid;
    grid-template-columns: minmax(320px, 0.9fr) minmax(0, 1.25fr);
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

@media (max-width: 1200px) {
  .recon-workspace {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto;
  }

  .workspace-section:first-child {
    height: auto;
  }

  .workspace-section + .workspace-section {
    border-top: 1px solid var(--scan-section-border);
    border-left: 0;
  }
}

</style>
