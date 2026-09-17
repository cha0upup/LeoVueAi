<template>
  <div class="http-sender-workbench">
    <div
      class="mode-strip"
      aria-label="发包模式"
    >
      <button
        v-for="mode in modes"
        :key="mode.key"
        type="button"
        :aria-pressed="activeMode === mode.key"
        :class="{ active: activeMode === mode.key }"
        @click="activeMode = mode.key"
      >
        {{ mode.label }} <span>{{ mode.name }}</span>
      </button>
    </div>

    <div class="target-toolbar">
      <label class="target-host">
        <span>目标</span>
        <el-input
          v-model="activeConfig.targetHost"
          aria-label="连接目标，留空使用报文 Host"
          placeholder="留空使用报文 Host"
          size="small"
          clearable
          :disabled="activeBusy"
        />
      </label>
      <label class="target-port">
        <span>端口</span>
        <el-input-number
          v-model="activeConfig.targetPort"
          aria-label="连接端口，留空自动解析"
          :min="1"
          :max="65535"
          :controls="false"
          :placeholder="`自动 (${resolvedTarget.port})`"
          size="small"
          :disabled="activeBusy"
        />
      </label>
      <el-select
        v-model="activeConfig.useTls"
        aria-label="连接协议"
        size="small"
        class="target-protocol"
        :disabled="activeBusy"
      >
        <el-option
          label="HTTP"
          :value="false"
        />
        <el-option
          label="HTTPS"
          :value="true"
        />
      </el-select>
      <el-checkbox
        v-if="activeMode === 'repeater'"
        v-model="repeaterConfig.followRedirects"
        size="small"
        :disabled="isSending"
      >
        跟随重定向
      </el-checkbox>
      <div class="send-actions">
        <el-button
          v-if="activeMode === 'repeater'"
          type="primary"
          size="small"
          :loading="isSending"
          :disabled="isSending"
          @click="handleSend"
        >
          发送请求
        </el-button>
        <template v-else>
          <el-button
            type="primary"
            size="small"
            :loading="isFuzzing"
            :disabled="isFuzzing"
            @click="handleStartFuzz"
          >
            开始批量请求
          </el-button>
          <el-button
            v-if="isFuzzing"
            type="danger"
            plain
            size="small"
            :loading="isStoppingFuzz"
            :disabled="!fuzzTask || isStoppingFuzz"
            @click="handleStopFuzz"
          >
            停止
          </el-button>
        </template>
      </div>
    </div>
    <div class="target-summary">
      <span>连接目标</span>
      <code :title="targetSummary">{{ targetSummary }}</code>
      <span class="target-note">从当前节点发送 · Host 头以报文为准</span>
    </div>

    <section
      v-show="activeMode === 'repeater'"
      class="sender-main"
    >
      <div
        class="compact-pane-switch"
        aria-label="请求与响应视图"
      >
        <button
          type="button"
          :aria-pressed="activePane === 'request'"
          @click="activePane = 'request'"
        >
          请求
        </button>
        <button
          type="button"
          :aria-pressed="activePane === 'response'"
          @click="activePane = 'response'"
        >
          响应
          <span v-if="isSending">· 发送中</span>
          <span v-else-if="responseError">· 失败</span>
          <span v-else-if="repeaterResponse">· {{ repeaterResponse.statusCode || '已返回' }}</span>
        </button>
      </div>
      <div
        class="repeater-layout"
        :data-active-pane="activePane"
      >
        <div class="repeater-request-pane">
          <div class="pane-header">
            <span class="pane-title">请求报文</span>
            <span class="pane-hint">原始 HTTP</span>
          </div>
          <div
            ref="requestEditorContainer"
            class="editor-container"
          />
        </div>
        <div
          class="repeater-response-pane"
          :aria-busy="isSending"
        >
          <div class="pane-header">
            <span class="pane-title">响应</span>
            <div
              v-if="repeaterResponse"
              class="response-meta"
            >
              <span
                v-if="isSending || responseError"
                class="pane-hint"
              >上次响应</span>
              <el-tag
                :type="getHttpStatusTagType(repeaterResponse.statusCode)"
                size="small"
              >
                {{ repeaterResponse.statusCode || '无状态码' }}
              </el-tag>
              <span>{{ repeaterResponse.elapsed }} ms</span>
              <span>{{ formatBytes(repeaterResponse.bodyLength) }}</span>
            </div>
          </div>
          <div
            v-if="isSending"
            class="request-feedback"
            role="status"
          >
            正在请求 {{ attemptedTarget }}…
          </div>
          <div
            v-else-if="responseError"
            class="request-feedback error"
            role="alert"
          >
            <strong>发送失败</strong>
            <span>{{ attemptedTarget }}</span>
            <span>{{ responseError }}</span>
          </div>
          <div
            v-if="repeaterResponse"
            class="response-target"
            :title="responseTarget"
          >
            {{ responseTarget }}
          </div>
          <div class="response-body">
            <div
              v-if="!repeaterResponse"
              class="empty-state"
            >
              <Icon :icon="responseError ? 'mdi:alert-circle-outline' : 'mdi:swap-horizontal'" />
              <strong>{{
                isSending ? '等待响应' : responseError ? '未收到响应' : '尚未发送请求'
              }}</strong>
              <span>{{
                responseError
                  ? '检查目标与请求报文后重新发送'
                  : isSending
                    ? '请求完成后将在这里显示结果'
                    : '确认连接目标并编辑报文，然后点击「发送请求」'
              }}</span>
            </div>
            <div
              v-show="repeaterResponse"
              ref="responseEditorContainer"
              class="editor-container"
            />
          </div>
        </div>
      </div>
    </section>

    <section
      v-show="activeMode === 'fuzzer'"
      class="sender-main"
    >
      <div class="fuzzer-layout">
        <div class="fuzzer-config-pane">
          <div class="fuzzer-config-row">
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
            <div class="fuzzer-params-section">
              <div class="pane-header">
                <span class="pane-title">变量配置</span>
                <el-button
                  size="small"
                  text
                  :disabled="isFuzzing"
                  @click="addPayloadVar"
                >
                  添加变量
                </el-button>
              </div>
              <div class="payload-vars-list">
                <div
                  v-for="(item, idx) in payloadVars"
                  :key="idx"
                  class="payload-var-item"
                >
                  <el-input
                    v-model="item.name"
                    :aria-label="`变量 ${idx + 1} 名称`"
                    placeholder="变量名，如 id"
                    size="small"
                    :disabled="isFuzzing"
                  />
                  <el-button
                    text
                    size="small"
                    :aria-label="`删除变量 ${idx + 1}`"
                    :disabled="isFuzzing"
                    @click="payloadVars.splice(idx, 1)"
                  >
                    <Icon icon="mdi:close" />
                  </el-button>
                  <el-input
                    v-model="item.values"
                    :aria-label="`变量 ${idx + 1} 的值，每行一个`"
                    placeholder="每行一个值"
                    type="textarea"
                    :rows="3"
                    resize="vertical"
                    size="small"
                    class="var-values-input"
                    :disabled="isFuzzing"
                  />
                </div>
                <p
                  v-if="!payloadVars.length"
                  class="empty-vars"
                >
                  添加变量，并在请求模板中标记替换位置。
                </p>
              </div>
              <details class="fuzzer-settings">
                <summary>高级设置 <span>并发、延迟与匹配规则</span></summary>
                <div class="settings-grid">
                  <label>
                    <span>并发数</span>
                    <el-input-number
                      v-model="fuzzerConfig.threads"
                      aria-label="并发数"
                      :min="1"
                      :max="50"
                      size="small"
                      controls-position="right"
                      :disabled="isFuzzing"
                    />
                  </label>
                  <label>
                    <span>请求间隔（ms）</span>
                    <el-input-number
                      v-model="fuzzerConfig.delayMs"
                      aria-label="请求间隔，毫秒"
                      :min="0"
                      :max="10000"
                      size="small"
                      controls-position="right"
                      :disabled="isFuzzing"
                    />
                  </label>
                  <label>
                    <span>匹配状态码</span>
                    <el-input
                      v-model="fuzzerConfig.matchStatusCode"
                      aria-label="匹配状态码"
                      placeholder="如 200,302"
                      size="small"
                      :disabled="isFuzzing"
                    />
                  </label>
                  <label>
                    <span>响应正文包含</span>
                    <el-input
                      v-model="fuzzerConfig.matchBodyContains"
                      aria-label="响应正文包含"
                      placeholder="关键字"
                      size="small"
                      :disabled="isFuzzing"
                    />
                  </label>
                </div>
              </details>
            </div>
          </div>
        </div>
        <div
          v-if="fuzzTask"
          class="fuzz-progress"
          role="status"
        >
          <el-tag
            size="small"
            :type="fuzzStatusTagType"
          >
            {{ fuzzStatusLabel }}
          </el-tag>
          <span>已完成 {{ fuzzTask.completed || 0 }} / {{ fuzzTask.total || 0 }}</span>
        </div>
        <HttpFuzzResults
          :results="fuzzResults"
          :loading="isFuzzing"
        />
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { monaco } from '@/utils/monaco.js'
import { useMonacoTheme } from '@/composables/useMonacoTheme.js'
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
const activePane = ref('request')
const modes = [
  { key: 'repeater', label: '单次请求', name: 'Repeater' },
  { key: 'fuzzer', label: '批量请求', name: 'Fuzzer' }
]

const fuzzerHintText = '使用 {{变量名}} 标记替换位置'

// ==================== Repeater 状态 ====================

const requestEditorContainer = ref(null)
const responseEditorContainer = ref(null)
let requestEditor = null
let responseEditor = null

const isSending = ref(false)
const repeaterResponse = ref(null)
const responseError = ref('')
const responseTarget = ref('')
const attemptedTarget = ref('')
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
const rawRequests = reactive({ repeater: DEFAULT_RAW_HTTP, fuzzer: DEFAULT_RAW_HTTP })

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
const fuzzStatusLabel = computed(
  () =>
    ({
      RUNNING: '运行中',
      FINISHED: '已完成',
      STOPPED: '已停止',
      FAILED: '失败'
    })[fuzzTask.value?.status] || '等待状态'
)
const activeConfig = computed(() =>
  activeMode.value === 'repeater' ? repeaterConfig : fuzzerConfig
)
const activeBusy = computed(() =>
  activeMode.value === 'repeater' ? isSending.value : isFuzzing.value
)
const resolvedTarget = computed(() =>
  resolveHttpTarget(rawRequests[activeMode.value], activeConfig.value)
)
const targetSummary = computed(() => {
  const { host, port } = resolvedTarget.value
  return host
    ? `${activeConfig.value.useTls ? 'https' : 'http'}://${host}:${port}`
    : '请填写目标或报文 Host 头'
})
const { monacoTheme, watchMonacoTheme } = useMonacoTheme()
watchMonacoTheme(() => [requestEditor, responseEditor, fuzzerEditor])

// ==================== Monaco HTTP 语法高亮 ====================

// 注册自定义 HTTP 语言（仅注册一次）
if (!monaco.languages.getLanguages().some((lang) => lang.id === 'http-raw')) {
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
        [/.+/, 'comment']
      ],
      requestLine: [
        [/\s+\S+\s+HTTP\/[\d.]+/, 'string', '@pop'],
        [/\s+\S+/, 'string', '@pop'],
        [/$/, '', '@pop']
      ],
      statusLine: [
        [/(\s+)(\d{3})(\s+.*)?/, ['', 'number', 'string'], '@pop'],
        [/$/, '', '@pop']
      ]
    }
  })
}

// ==================== Monaco 编辑器 ====================

function createEditor(container, value, readOnly = false) {
  if (!container) return null
  return monaco.editor.create(container, {
    value: value || '',
    language: 'http-raw',
    theme: monacoTheme.value,
    minimap: { enabled: false },
    lineNumbers: 'on',
    lineNumbersMinChars: 3,
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
function attachContentLengthFixer(editor, mode) {
  let fixing = false
  return editor.onDidChangeModelContent(() => {
    rawRequests[mode] = editor.getValue()
    if (fixing) return
    const update = getContentLengthUpdate(editor.getValue())
    if (!update) return
    fixing = true
    const model = editor.getModel()
    try {
      const currentLine = model?.getLineContent(update.lineNumber) || ''
      model?.pushEditOperations(
        [],
        [
          {
            range: new monaco.Range(
              update.lineNumber,
              1,
              update.lineNumber,
              currentLine.length + 1
            ),
            text: update.text
          }
        ],
        () => null
      )
    } finally {
      fixing = false
    }
  })
}

function ensureActiveEditor() {
  if (activeMode.value === 'repeater' && !requestEditor && requestEditorContainer.value) {
    requestEditor = createEditor(requestEditorContainer.value, rawRequests.repeater)
    attachContentLengthFixer(requestEditor, 'repeater')
  }
  if (activeMode.value === 'fuzzer' && !fuzzerEditor && fuzzerEditorContainer.value) {
    fuzzerEditor = createEditor(fuzzerEditorContainer.value, rawRequests.fuzzer)
    attachContentLengthFixer(fuzzerEditor, 'fuzzer')
  }
}

onMounted(ensureActiveEditor)
watch(activeMode, ensureActiveEditor, { flush: 'post' })

function disposeEditor(editor) {
  const model = editor?.getModel()
  editor?.dispose()
  model?.dispose()
}

onBeforeUnmount(() => {
  requestGuard.invalidate()
  stopFuzzPolling()
  disposeEditor(requestEditor)
  disposeEditor(responseEditor)
  disposeEditor(fuzzerEditor)
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
    responseError.value = ''
    responseTarget.value = ''
    attemptedTarget.value = ''
    activePane.value = 'request'
    fuzzTask.value = null
    fuzzResults.value = []
    if (responseEditor) {
      disposeEditor(responseEditor)
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
  const { host, port } = resolveHttpTarget(rawHttp, repeaterConfig)
  if (!host) {
    showWarning('请填写连接目标或报文 Host 头')
    return
  }

  const sessionId = props.sessionId
  const sequence = requestGuard.next('send')
  isSending.value = true
  responseError.value = ''
  attemptedTarget.value = `${repeaterConfig.useTls ? 'https' : 'http'}://${host}:${port}`
  activePane.value = 'response'

  try {
    const startTime = Date.now()
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
    responseTarget.value = attemptedTarget.value
    await nextTick()
    if (requestGuard.isCurrent('send', sequence)) updateResponseEditor()
  } catch (err) {
    if (requestGuard.isCurrent('send', sequence) && sessionId === props.sessionId) {
      responseError.value = err?.message || String(err)
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
  const schedule = (delay) => {
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

function formatBytes(bytes) {
  if (bytes == null) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}
</script>

<style scoped>
.http-sender-workbench {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  overflow: hidden;
  background: var(--el-bg-color);
  container-type: inline-size;
}

.mode-strip,
.target-toolbar,
.target-summary,
.pane-header,
.response-meta,
.fuzz-progress {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mode-strip {
  padding: 6px 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.mode-strip button,
.compact-pane-switch button {
  border: 0;
  border-radius: 4px;
  padding: 6px 10px;
  color: var(--el-text-color-regular);
  background: transparent;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.mode-strip button span {
  margin-left: 4px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.mode-strip button:hover,
.compact-pane-switch button:hover {
  background: var(--el-fill-color-light);
}

.mode-strip button.active,
.compact-pane-switch button[aria-pressed='true'] {
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 12%, var(--el-bg-color));
}

button:focus-visible,
summary:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

.target-toolbar {
  flex-wrap: wrap;
  padding: 10px 12px 6px;
}

.target-toolbar label {
  display: flex;
  align-items: center;
  gap: 6px;
}

.target-toolbar label > span {
  flex-shrink: 0;
  color: var(--el-text-color-regular);
  font-size: 12px;
}

.target-host {
  flex: 1 1 180px;
  min-width: 180px;
}

.target-host .el-input {
  min-width: 0;
}
.target-port {
  flex: 0 0 auto;
}
.target-port .el-input-number {
  width: 112px;
}
.target-protocol {
  width: 90px;
  flex-shrink: 0;
}
.target-toolbar .el-checkbox {
  margin-right: 0;
}
.send-actions {
  display: flex;
  margin-left: auto;
}

.target-summary {
  flex-wrap: wrap;
  gap: 4px 8px;
  padding: 0 12px 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.target-summary code {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--el-text-color-regular);
}

.target-note {
  margin-left: auto;
}
.sender-main,
.fuzzer-layout,
.repeater-layout,
.repeater-request-pane,
.repeater-response-pane,
.fuzzer-template-section,
.response-body {
  display: flex;
  flex: 1;
  min-height: 0;
  min-width: 0;
}

.sender-main,
.fuzzer-layout,
.repeater-request-pane,
.repeater-response-pane,
.fuzzer-template-section,
.response-body {
  flex-direction: column;
}
.sender-main {
  overflow: hidden;
}
.compact-pane-switch {
  display: none;
}
.repeater-request-pane {
  border-right: 1px solid var(--el-border-color-lighter);
}

.pane-header {
  justify-content: space-between;
  flex-shrink: 0;
  flex-wrap: wrap;
  min-height: 36px;
  box-sizing: border-box;
  padding: 6px 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-lighter);
}

.pane-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.pane-hint {
  color: var(--el-text-color-secondary);
  font-size: 11px;
}
.response-meta {
  flex-wrap: wrap;
  gap: 8px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.editor-container {
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}

.request-feedback {
  padding: 8px 12px;
  font-size: 12px;
  line-height: 1.6;
  overflow-wrap: anywhere;
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 10%, var(--el-bg-color));
  max-height: 30%;
  flex-shrink: 0;
  overflow: auto;
}

.request-feedback.error {
  color: var(--el-color-danger);
  background: color-mix(in srgb, var(--el-color-danger) 10%, var(--el-bg-color));
}
.request-feedback.error > * {
  display: block;
}
.response-target {
  padding: 5px 12px;
  color: var(--el-text-color-secondary);
  font: 11px monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
}

.empty-state {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px;
  text-align: center;
  font-size: 12px;
  line-height: 1.7;
  color: var(--el-text-color-secondary);
}

.empty-state > svg {
  font-size: 28px;
  color: var(--el-text-color-placeholder);
}
.empty-state strong {
  color: var(--el-text-color-regular);
  font-weight: 500;
}
.fuzzer-config-pane {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.fuzzer-config-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  min-height: 100%;
}
.fuzzer-template-section {
  min-height: 300px;
  border-right: 1px solid var(--el-border-color-lighter);
}
.fuzzer-params-section {
  min-width: 0;
}
.payload-vars-list {
  padding: 10px 12px;
}
.payload-var-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  margin-bottom: 12px;
}
.payload-var-item:last-child {
  margin-bottom: 0;
}
.var-values-input {
  grid-column: 1 / -1;
}
.empty-vars {
  margin: 8px 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.7;
}
.fuzzer-settings {
  border-top: 1px solid var(--el-border-color-lighter);
  padding: 12px;
}
.fuzzer-settings summary {
  cursor: pointer;
  color: var(--el-text-color-regular);
  font-size: 12px;
}
.fuzzer-settings summary span {
  margin-left: 6px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
}
.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}
.settings-grid label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  font-size: 12px;
  color: var(--el-text-color-regular);
}
.settings-grid .el-input-number {
  width: 100%;
}
.fuzz-progress {
  flex-shrink: 0;
  padding: 8px 12px;
  border-top: 1px solid var(--el-border-color-lighter);
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

@container (max-width: 720px) {
  .compact-pane-switch {
    display: flex;
    gap: 8px;
    padding: 6px 12px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }
  .repeater-layout[data-active-pane='request'] .repeater-response-pane,
  .repeater-layout[data-active-pane='response'] .repeater-request-pane {
    display: none;
  }
  .repeater-request-pane {
    border-right: 0;
  }
  .fuzzer-config-row {
    grid-template-columns: minmax(0, 1fr);
  }
  .fuzzer-template-section {
    height: 280px;
    min-height: 0;
    border-right: 0;
  }
  .fuzzer-params-section {
    border-top: 1px solid var(--el-border-color-lighter);
  }
  .target-note {
    flex-basis: 100%;
    margin-left: 0;
  }
}

@container (max-width: 520px) {
  .target-host {
    flex-basis: 100%;
  }
  .target-toolbar {
    gap: 8px;
  }
  .mode-strip button span {
    display: none;
  }
}
</style>
