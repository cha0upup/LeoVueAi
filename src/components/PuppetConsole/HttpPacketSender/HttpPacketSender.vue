<template>
  <div class="http-sender-workbench">
    <div class="http-sender-shell">
      <!-- 顶部模式切换 -->
      <section class="mode-strip">
        <button
          v-for="mode in modes"
          :key="mode.key"
          type="button"
          class="mode-item"
          :class="{ active: activeMode === mode.key }"
          @click="activeMode = mode.key"
        >
          <span class="mode-icon-shell">
            <el-icon><Icon :icon="mode.icon" /></el-icon>
          </span>
          <div class="mode-copy">
            <strong class="mode-title">{{ mode.label }}</strong>
            <span class="mode-meta">{{ mode.desc }}</span>
          </div>
        </button>
      </section>

      <!-- Repeater 模式 -->
      <section
        v-show="activeMode === 'repeater'"
        class="sender-main"
      >
        <div class="repeater-layout">
          <!-- 左侧：请求编辑 -->
          <div class="repeater-request-pane">
            <div class="pane-header">
              <span class="pane-title">请求报文</span>
              <div class="pane-controls">
                <el-input
                  v-model="repeaterConfig.targetHost"
                  placeholder="自动从 Host 头解析"
                  size="small"
                  class="target-input"
                />
                <el-input-number
                  v-model="repeaterConfig.targetPort"
                  :min="1"
                  :max="65535"
                  size="small"
                  placeholder="自动"
                  class="target-port"
                  controls-position="right"
                />
                <el-checkbox
                  v-model="repeaterConfig.useTls"
                  size="small"
                >
                  HTTPS
                </el-checkbox>
                <el-checkbox
                  v-model="repeaterConfig.followRedirects"
                  size="small"
                >
                  跟随重定向
                </el-checkbox>
                <el-button
                  type="primary"
                  size="small"
                  :loading="isSending"
                  :disabled="isSending"
                  @click="handleSend"
                >
                  <el-icon><Icon icon="mdi:send" /></el-icon>
                  发送
                </el-button>
              </div>
            </div>

            <!-- Monaco 编辑器 -->
            <div
              ref="requestEditorContainer"
              class="editor-container"
            />
          </div>

          <!-- 右侧：响应查看 -->
          <div class="repeater-response-pane">
            <div class="pane-header">
              <span class="pane-title">响应</span>
              <div
                v-if="repeaterResponse"
                class="response-meta"
              >
                <el-tag
                  :type="getStatusTagType(repeaterResponse.statusCode)"
                  size="small"
                  effect="dark"
                >
                  {{ repeaterResponse.statusCode || 'N/A' }}
                </el-tag>
                <span
                  v-if="repeaterResponse.elapsed"
                  class="meta-item"
                >
                  {{ repeaterResponse.elapsed }}ms
                </span>
                <span
                  v-if="repeaterResponse.bodyLength != null"
                  class="meta-item"
                >
                  {{ formatBytes(repeaterResponse.bodyLength) }}
                </span>
              </div>
            </div>

            <!-- 响应 Raw 视图 -->
            <div class="response-body">
              <div
                v-if="!repeaterResponse"
                class="empty-state"
              >
                <el-icon size="32">
                  <Icon icon="mdi:arrow-left" />
                </el-icon>
                <p>编辑请求报文后点击发送</p>
              </div>

              <div
                v-else
                class="resp-content"
              >
                <div
                  ref="responseEditorContainer"
                  class="response-editor-container"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Fuzzer 模式 -->
      <section
        v-show="activeMode === 'fuzzer'"
        class="sender-main"
      >
        <div class="fuzzer-layout">
          <!-- 上方：配置区 -->
          <div class="fuzzer-config-pane">
            <div class="fuzzer-config-row">
              <!-- 左：模板编辑 -->
              <div class="fuzzer-template-section">
                <div class="pane-header">
                  <span class="pane-title">请求模板</span>
                  <span
                    class="pane-hint"
                    v-text="fuzzerHintText"
                  />
                </div>
                <div
                  ref="fuzzerEditorContainer"
                  class="editor-container"
                />
              </div>

              <!-- 右：Payload + 参数 -->
              <div class="fuzzer-params-section">
                <div class="pane-header">
                  <span class="pane-title">Payload 配置</span>
                  <div class="pane-actions">
                    <el-button
                      size="small"
                      @click="addPayloadVar"
                    >
                      <el-icon><Icon icon="mdi:plus" /></el-icon>
                      添加变量
                    </el-button>
                  </div>
                </div>

                <div class="payload-vars-list">
                  <div
                    v-for="(item, idx) in payloadVars"
                    :key="idx"
                    class="payload-var-item"
                  >
                    <el-input
                      v-model="item.name"
                      placeholder="变量名"
                      size="small"
                      class="var-name-input"
                    />
                    <el-input
                      v-model="item.values"
                      placeholder="值列表（每行一个）"
                      type="textarea"
                      :rows="3"
                      size="small"
                      class="var-values-input"
                    />
                    <el-button
                      type="danger"
                      size="small"
                      text
                      :aria-label="`删除变量 ${idx + 1}`"
                      @click="payloadVars.splice(idx, 1)"
                    >
                      <el-icon><Icon icon="mdi:close" /></el-icon>
                    </el-button>
                  </div>

                  <div
                    v-if="payloadVars.length === 0"
                    class="empty-vars"
                  >
                    点击「添加变量」定义 Payload
                  </div>
                </div>

                <!-- 目标 + 参数 -->
                <div class="fuzzer-settings">
                  <div class="setting-row">
                    <el-input
                      v-model="fuzzerConfig.targetHost"
                      placeholder="自动从 Host 头解析"
                      size="small"
                    />
                    <el-input-number
                      v-model="fuzzerConfig.targetPort"
                      :min="1"
                      :max="65535"
                      size="small"
                      placeholder="自动"
                      controls-position="right"
                      class="target-port"
                    />
                    <el-checkbox
                      v-model="fuzzerConfig.useTls"
                      size="small"
                    >
                      HTTPS
                    </el-checkbox>
                  </div>
                  <div class="setting-row">
                    <label class="setting-label">线程数</label>
                    <el-input-number
                      v-model="fuzzerConfig.threads"
                      :min="1"
                      :max="50"
                      size="small"
                      controls-position="right"
                    />
                    <label class="setting-label">延迟(ms)</label>
                    <el-input-number
                      v-model="fuzzerConfig.delayMs"
                      :min="0"
                      :max="10000"
                      size="small"
                      controls-position="right"
                    />
                  </div>
                  <!-- 匹配规则 -->
                  <div class="setting-row">
                    <label class="setting-label">状态码匹配</label>
                    <el-input
                      v-model="fuzzerConfig.matchStatusCode"
                      placeholder="如 200 或 200,302"
                      size="small"
                    />
                    <label class="setting-label">Body 包含</label>
                    <el-input
                      v-model="fuzzerConfig.matchBodyContains"
                      placeholder="关键字"
                      size="small"
                    />
                  </div>
                </div>

                <div class="fuzzer-actions">
                  <el-button
                    type="primary"
                    :loading="isFuzzing"
                    :disabled="isFuzzing"
                    @click="handleStartFuzz"
                  >
                    <el-icon><Icon icon="mdi:play" /></el-icon>
                    启动 Fuzzer
                  </el-button>
                  <el-button
                    v-if="isFuzzing"
                    type="danger"
                    :loading="isStoppingFuzz"
                    :disabled="isStoppingFuzz"
                    @click="handleStopFuzz"
                  >
                    <el-icon><Icon icon="mdi:stop" /></el-icon>
                    停止
                  </el-button>
                  <span
                    v-if="fuzzTask"
                    class="fuzz-progress"
                  >
                    {{ fuzzTask.completed || 0 }} / {{ fuzzTask.total || 0 }}
                    <el-tag
                      size="small"
                      :type="fuzzStatusTagType"
                    >{{ fuzzTask.status }}</el-tag>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <HttpFuzzResults :results="fuzzResults" />
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { Icon } from '@iconify/vue'
import * as monaco from 'monaco-editor'
import { sendRawHttpApi, startFuzzApi, queryFuzzApi, stopFuzzApi } from '@/services/api.js'
import { showError, showSuccess, showWarning } from '@/utils/messageUtils.js'
import { createLatestRequestGuard } from '@/utils/latestRequestGuard.js'
import HttpFuzzResults from './HttpFuzzResults.vue'
import {
  buildFuzzMatchRules,
  buildPayloadsMap,
  buildRawHttpResponse,
  getContentLengthUpdate,
  getFuzzStatusTagType,
  getHttpStatusTagType,
  isTerminalFuzzStatus,
  normalizeFuzzSnapshot,
  normalizeRepeaterResponse,
  resolveHttpTarget
} from './httpPacketSenderModel.js'

const props = defineProps({
  sessionId: {
    type: String,
    required: true
  }
})

// ==================== 模式切换 ====================

const activeMode = ref('repeater')
const modes = [
  { key: 'repeater', label: 'Repeater', desc: '单包发送/调试', icon: 'mdi:send' },
  { key: 'fuzzer', label: 'Fuzzer', desc: '批量变量替换发包', icon: 'mdi:autorenew' }
]

const fuzzerHintText = '使用 {{变量名}} 标记替换位置'

// ==================== Repeater 状态 ====================

const requestEditorContainer = ref(null)
const responseEditorContainer = ref(null)
let requestEditor = null
let responseEditor = null

const isSending = ref(false)
const repeaterResponse = ref(null)
const requestGuard = createLatestRequestGuard(['send', 'fuzz-start', 'fuzz-stop'])

const repeaterConfig = reactive({
  targetHost: '',
  targetPort: null,
  useTls: true,
  followRedirects: false
})

const DEFAULT_RAW_HTTP = `GET / HTTP/1.1
Host: example.com
User-Agent: LeoAI/1.0
Accept: */*

`

// ==================== Fuzzer 状态 ====================

const fuzzerEditorContainer = ref(null)
let fuzzerEditor = null

const isFuzzing = ref(false)
const isStoppingFuzz = ref(false)
const fuzzTask = ref(null)
const fuzzResults = ref([])
let fuzzPollTimer = null

const payloadVars = ref([])

const fuzzerConfig = reactive({
  targetHost: '',
  targetPort: null,
  useTls: false,
  threads: 5,
  delayMs: 0,
  matchStatusCode: '',
  matchBodyContains: ''
})

const fuzzStatusTagType = computed(() => {
  return getFuzzStatusTagType(fuzzTask.value?.status)
})

// ==================== Monaco HTTP 语法高亮 ====================

// 注册自定义 HTTP 语言（仅注册一次）
if (!monaco.languages.getLanguages().some(lang => lang.id === 'http-raw')) {
  monaco.languages.register({ id: 'http-raw' })

  monaco.languages.setMonarchTokensProvider('http-raw', {
    tokenizer: {
      root: [
        // 请求行: METHOD URI HTTP/x.x
        [/^(GET|POST|PUT|DELETE|HEAD|OPTIONS|PATCH|TRACE|CONNECT)\b/, 'keyword', '@requestLine'],
        // 响应状态行: HTTP/x.x STATUS MESSAGE
        [/^HTTP\/[\d.]+/, 'keyword', '@statusLine'],
        // Header: Key: Value（groups 必须覆盖全部匹配字符）
        [/([\w-]+)(:)(.*)/, ['type', 'delimiter', 'string']],
        // Body 内容（空行之后的所有内容归入此处）
        [/.+/, 'comment'],
      ],
      requestLine: [
        [/\s+\S+\s+HTTP\/[\d.]+/, 'string', '@pop'],
        [/\s+\S+/, 'string', '@pop'],
        [/$/, '', '@pop'],
      ],
      statusLine: [
        [/(\s+)(\d{3})(\s+.*)?/, ['', 'number', 'string'], '@pop'],
        [/$/, '', '@pop'],
      ],
    }
  })

  // 自定义主题：给 token 分配颜色
  monaco.editor.defineTheme('http-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: 'C586C0', fontStyle: 'bold' },  // 紫色 - METHOD / HTTP版本
      { token: 'type', foreground: '4EC9B0', fontStyle: 'bold' },     // 青绿 - Header Key
      { token: 'delimiter', foreground: 'D4D4D4' },                   // 灰色 - 冒号
      { token: 'string', foreground: 'CE9178' },                      // 橙色 - Header Value / URI
      { token: 'number', foreground: 'B5CEA8', fontStyle: 'bold' },   // 绿色 - 状态码
      { token: 'comment', foreground: 'D4D4D4' },                     // 白色 - Body
    ],
    colors: {}
  })
}

// ==================== Monaco 编辑器 ====================

function createEditor(container, value, readOnly = false) {
  if (!container) return null
  return monaco.editor.create(container, {
    value: value || '',
    language: 'http-raw',
    theme: 'http-dark',
    minimap: { enabled: false },
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    wordWrap: 'on',
    readOnly,
    fontSize: 13,
    automaticLayout: true,
    tabSize: 2
  })
}

/**
 * 给编辑器绑定 Content-Length 自动修正
 * 当存在请求体（空行之后有内容）且已有 Content-Length 头时，自动更新其值
 */
function attachContentLengthFixer(editor) {
  let fixing = false
  return editor.onDidChangeModelContent(() => {
    if (fixing) return
    const update = getContentLengthUpdate(editor.getValue())
    if (!update) return
    fixing = true
    const model = editor.getModel()
    try {
      const currentLine = model?.getLineContent(update.lineNumber) || ''
      model?.pushEditOperations(
        [],
        [{
          range: new monaco.Range(update.lineNumber, 1, update.lineNumber, currentLine.length + 1),
          text: update.text
        }],
        () => null
      )
    } finally {
      fixing = false
    }
  })
}

onMounted(() => {
  nextTick(() => {
    if (requestEditorContainer.value) {
      requestEditor = createEditor(requestEditorContainer.value, DEFAULT_RAW_HTTP)
      attachContentLengthFixer(requestEditor)
    }
  })
})

// 切换模式时创建对应编辑器
watch(activeMode, (mode) => {
  nextTick(() => {
    if (mode === 'repeater' && !requestEditor && requestEditorContainer.value) {
      requestEditor = createEditor(requestEditorContainer.value, DEFAULT_RAW_HTTP)
      attachContentLengthFixer(requestEditor)
    }
    if (mode === 'fuzzer' && !fuzzerEditor && fuzzerEditorContainer.value) {
      fuzzerEditor = createEditor(fuzzerEditorContainer.value, DEFAULT_RAW_HTTP)
      attachContentLengthFixer(fuzzerEditor)
    }
  })
})

onBeforeUnmount(() => {
  requestGuard.invalidate()
  stopFuzzPolling()
  if (requestEditor) { requestEditor.dispose(); requestEditor = null }
  if (responseEditor) { responseEditor.dispose(); responseEditor = null }
  if (fuzzerEditor) { fuzzerEditor.dispose(); fuzzerEditor = null }
})

watch(
  () => props.sessionId,
  () => {
    requestGuard.invalidate()
    stopFuzzPolling()
    isSending.value = false
    isFuzzing.value = false
    isStoppingFuzz.value = false
    repeaterResponse.value = null
    fuzzTask.value = null
    fuzzResults.value = []
    if (responseEditor) {
      responseEditor.dispose()
      responseEditor = null
    }
  }
)

function updateResponseEditor() {
  if (!repeaterResponse.value) return
  const rawText = buildRawHttpResponse(repeaterResponse.value)

  if (responseEditor) {
    responseEditor.setValue(rawText)
  } else if (responseEditorContainer.value) {
    responseEditor = createEditor(responseEditorContainer.value, rawText, true)
  }
}

// ==================== Repeater 发送 ====================

async function handleSend() {
  if (!requestEditor || isSending.value) return
  const rawHttp = requestEditor.getValue()
  if (!rawHttp.trim()) {
    showWarning('请输入 HTTP 请求报文')
    return
  }

  const sessionId = props.sessionId
  const sequence = requestGuard.next('send')
  isSending.value = true

  // 先销毁旧的响应编辑器（因为 v-if 切换会移除 DOM 导致引用失效）
  if (responseEditor) {
    responseEditor.dispose()
    responseEditor = null
  }
  repeaterResponse.value = null

  try {
    const startTime = Date.now()
    const { host, port } = resolveHttpTarget(rawHttp, repeaterConfig)
    const response = await sendRawHttpApi({
      sessionId,
      rawHttp,
      targetHost: host || undefined,
      targetPort: port,
      useTls: repeaterConfig.useTls,
      followRedirects: repeaterConfig.followRedirects
    })

    if (!requestGuard.isCurrent('send', sequence) || sessionId !== props.sessionId) return
    const data = response.data
    const elapsed = Date.now() - startTime
    repeaterResponse.value = normalizeRepeaterResponse(data, elapsed)
    await nextTick()
    if (requestGuard.isCurrent('send', sequence)) updateResponseEditor()
  } catch (err) {
    if (requestGuard.isCurrent('send', sequence) && sessionId === props.sessionId) {
      showError(`发送失败: ${err?.message || err}`)
    }
  } finally {
    if (requestGuard.isCurrent('send', sequence)) isSending.value = false
  }
}

// ==================== Fuzzer ====================

function addPayloadVar() {
  payloadVars.value.push({ name: '', values: '' })
}

async function handleStartFuzz() {
  if (!fuzzerEditor || isFuzzing.value) return
  const rawHttp = fuzzerEditor.getValue()
  if (!rawHttp.trim()) {
    showWarning('请输入 HTTP 请求模板')
    return
  }

  const payloads = buildPayloadsMap(payloadVars.value)
  if (Object.keys(payloads).length === 0) {
    showWarning('至少添加一个非空 Payload 变量')
    return
  }

  const sessionId = props.sessionId
  const sequence = requestGuard.next('fuzz-start')
  isFuzzing.value = true
  fuzzResults.value = []
  fuzzTask.value = null

  try {
    const { host, port } = resolveHttpTarget(rawHttp, fuzzerConfig)
    const response = await startFuzzApi({
      sessionId,
      rawHttp,
      payloads,
      targetHost: host || undefined,
      targetPort: port,
      useTls: fuzzerConfig.useTls,
      threads: fuzzerConfig.threads,
      delayMs: fuzzerConfig.delayMs,
      matchRules: buildFuzzMatchRules(fuzzerConfig)
    })

    if (!requestGuard.isCurrent('fuzz-start', sequence) || sessionId !== props.sessionId) return
    const data = response.data
    if (!data.taskId) throw new Error('服务端未返回任务编号')
    fuzzTask.value = { taskId: data.taskId, total: data.total, completed: 0, status: 'RUNNING' }
    showSuccess(`Fuzzer 已启动，共 ${data.total} 个组合`)
    startFuzzPolling(data.taskId, sessionId)
  } catch (err) {
    if (requestGuard.isCurrent('fuzz-start', sequence) && sessionId === props.sessionId) {
      showError(`启动 Fuzzer 失败: ${err?.message || err}`)
      isFuzzing.value = false
    }
  }
}

let fuzzPollGeneration = 0

function stopFuzzPolling() {
  fuzzPollGeneration += 1
  if (fuzzPollTimer !== null) window.clearTimeout(fuzzPollTimer)
  fuzzPollTimer = null
}

function startFuzzPolling(taskId, sessionId) {
  stopFuzzPolling()
  const generation = fuzzPollGeneration
  let consecutiveFailures = 0
  const schedule = delay => {
    if (generation !== fuzzPollGeneration) return
    fuzzPollTimer = window.setTimeout(poll, delay)
  }
  const poll = async () => {
    if (generation !== fuzzPollGeneration || sessionId !== props.sessionId) return
    try {
      const response = await queryFuzzApi({ sessionId, taskId })
      if (generation !== fuzzPollGeneration || sessionId !== props.sessionId) return
      consecutiveFailures = 0
      const snapshot = normalizeFuzzSnapshot(response.data, taskId)
      fuzzTask.value = snapshot.task
      fuzzResults.value = snapshot.results
      if (isTerminalFuzzStatus(snapshot.task.status)) {
        stopFuzzPolling()
        isFuzzing.value = false
        isStoppingFuzz.value = false
      } else {
        schedule(1000)
      }
    } catch {
      consecutiveFailures += 1
      if (consecutiveFailures === 3 && generation === fuzzPollGeneration) {
        showWarning('Fuzzer 状态刷新连续失败，正在自动重试')
      }
      schedule(Math.min(5000, 1000 * (consecutiveFailures + 1)))
    }
  }
  poll()
}

async function handleStopFuzz() {
  if (!fuzzTask.value || isStoppingFuzz.value) return
  const sessionId = props.sessionId
  const taskId = fuzzTask.value.taskId
  const sequence = requestGuard.next('fuzz-stop')
  isStoppingFuzz.value = true
  try {
    await stopFuzzApi({ sessionId, taskId })
    if (!requestGuard.isCurrent('fuzz-stop', sequence) || sessionId !== props.sessionId) return
    stopFuzzPolling()
    fuzzTask.value = { ...fuzzTask.value, status: 'STOPPED' }
    isFuzzing.value = false
    showSuccess('Fuzzer 已停止')
  } catch (err) {
    if (requestGuard.isCurrent('fuzz-stop', sequence) && sessionId === props.sessionId) {
      showError(`停止失败: ${err?.message || err}`)
    }
  } finally {
    if (requestGuard.isCurrent('fuzz-stop', sequence)) isStoppingFuzz.value = false
  }
}

// ==================== 工具函数 ====================

const getStatusTagType = getHttpStatusTagType

function formatBytes(bytes) {
  if (bytes == null) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

</script>

<style scoped>
.http-sender-workbench {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
  overflow: hidden;
}

.http-sender-shell {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* ── 模式切换条 ── */
.mode-strip {
  display: flex;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color-page);
}

.mode-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-bg-color);
  cursor: pointer;
  transition: all 0.2s;
}

.mode-item:hover {
  border-color: var(--el-color-primary-light-3);
}

.mode-item.active {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.mode-icon-shell {
  font-size: 18px;
  color: var(--el-text-color-secondary);
}

.mode-item.active .mode-icon-shell {
  color: var(--el-color-primary);
}

.mode-copy {
  display: flex;
  flex-direction: column;
  text-align: left;
}

.mode-title {
  font-size: 13px;
  font-weight: 600;
}

.mode-meta {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}

/* ── Sender Main ── */
.sender-main {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* ── Repeater Layout ── */
.repeater-layout {
  display: flex;
  height: 100%;
}

.repeater-request-pane,
.repeater-response-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  border-right: 1px solid var(--el-border-color-lighter);
}

.repeater-layout .pane-header {
  min-height: 40px;
}

.repeater-response-pane {
  border-right: none;
}

.pane-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  gap: 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color-page);
}

.pane-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  justify-content: flex-end;
}

.pane-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.pane-hint {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  margin-left: 8px;
}

.pane-actions {
  display: flex;
  gap: 6px;
}

/* ── 目标配置内联 ── */
.target-input {
  max-width: 180px;
}

.target-port {
  width: 100px;
}

/* ── 编辑器容器 ── */
.editor-container {
  flex: 1;
  min-height: 200px;
}

.response-editor-container {
  height: 100%;
  min-height: 200px;
}

/* ── 响应元信息 ── */
.response-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.meta-item {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.response-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.resp-content {
  height: 100%;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--el-text-color-placeholder);
  gap: 8px;
}

/* ── Fuzzer Layout ── */
.fuzzer-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.fuzzer-config-pane {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.fuzzer-config-row {
  display: flex;
  height: 100%;
}

.fuzzer-template-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--el-border-color-lighter);
  min-width: 0;
}

.fuzzer-params-section {
  width: 380px;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.payload-vars-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px;
}

.payload-var-item {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-bottom: 8px;
  padding: 8px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  background: var(--el-bg-color-page);
}

.var-name-input {
  width: 100px;
  flex-shrink: 0;
}

.var-values-input {
  flex: 1;
}

.empty-vars {
  padding: 24px;
  text-align: center;
  color: var(--el-text-color-placeholder);
  font-size: 13px;
}

.fuzzer-settings {
  padding: 8px 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.setting-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.setting-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.fuzzer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.fuzz-progress {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-left: 8px;
}

</style>
