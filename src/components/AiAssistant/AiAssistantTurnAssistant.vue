<template>
  <section
    class="turn turn-assistant"
    :class="{
      'turn-assistant--continuation': isContinuation,
      'turn-assistant--user-input': hasUserInput
    }"
  >
    <div class="turn-inner">
      <div class="assistant-wrap">
        <!-- ── Header ─────────────────────────────────────────────── -->
        <div
          v-if="!isContinuation"
          class="turn-header"
        >
          <span class="ai-badge">
            <Icon
              icon="mdi:robot-outline"
              class="ai-badge-icon"
            />
            <span class="ai-badge-label">AI 助理</span>
          </span>
          <span class="turn-elapsed">{{ formatElapsedLabel(msg.startedAt, msg.completedAt) }}</span>
          <span
            v-if="msg.loading"
            class="status-pulse"
            aria-label="处理中"
          />
        </div>

        <div class="assistant-divider" />

        <!-- ── Task Tree ───────────────────────────────────────────── -->
        <div
          v-if="visibleNodes.length"
          class="task-tree"
        >
          <template v-if="shouldArchiveProcess">
            <div
              v-if="archivedProcessNodes.length"
              class="process-archive"
            >
              <button
                type="button"
                class="process-archive__toggle"
                :aria-expanded="processExpanded"
                @click="processExpanded = !processExpanded"
              >
                <Icon :icon="processExpanded ? 'mdi:chevron-down' : 'mdi:chevron-right'" />
                <Icon
                  icon="mdi:timeline-clock-outline"
                  class="process-archive__icon"
                />
                <span>执行过程</span>
                <small>{{ processSummary }}</small>
              </button>
              <div
                v-if="processExpanded"
                class="process-archive__body"
              >
                <TaskNode
                  v-for="node in archivedProcessNodes"
                  :key="node.id"
                  :node="node"
                  collapse-process
                  @answer-user-input="answerUserInput"
                />
              </div>
            </div>
            <div
              v-if="conclusionNodes.length"
              class="final-conclusion"
            >
              <span class="final-conclusion__label">最终结论</span>
              <TaskNode
                v-for="node in conclusionNodes"
                :key="node.id"
                :node="node"
                @answer-user-input="answerUserInput"
              />
            </div>
          </template>
          <template v-else>
            <TaskNode
              v-for="node in visibleNodes"
              :key="node.id"
              :node="node"
              @answer-user-input="answerUserInput"
            />
          </template>
        </div>

        <AiUserInputCard
          v-for="request in userInputRequests"
          :key="request.questionId"
          :request="request"
          :submitting="request.questionId === pendingUserInput?.questionId && isAnswering"
          @answer="answerUserInput"
        />

        <!-- ── Loading skeleton (no nodes yet) ────────────────────── -->
        <div
          v-if="msg.loading && !visibleNodes.length && !pendingUserInput"
          class="assistant-loading"
          aria-busy="true"
          aria-label="正在生成回复"
        >
          <el-skeleton
            :rows="3"
            animated
          />
          <p class="loading-hint">
            正在生成回复，请稍候…
          </p>
        </div>

        <!-- ── Error bar ──────────────────────────────────────────── -->
        <div
          v-if="msg.failed"
          class="error-bar"
        >
          <Icon
            icon="mdi:alert-circle-outline"
            class="error-icon"
          />
          <span class="error-hint">{{ errorMessage }}</span>
          <el-button
            size="small"
            text
            class="retry-btn"
            @click="emit('retry', msg)"
          >
            <Icon icon="mdi:refresh" />
            重试
          </el-button>
        </div>

        <div
          v-if="msg.failed && errorActions.length"
          class="error-action-bar"
        >
          <button
            v-for="action in errorActions"
            :key="action.code || action.label"
            type="button"
            class="error-action-chip"
            @click="handleErrorAction(action)"
          >
            <Icon :icon="errorActionIcon(action.code)" />
            <span>{{ action.label }}</span>
          </button>
        </div>

        <!-- ── Review / usage footer ──────────────────────────────── -->
        <div
          v-if="!hasUserInput && (reviewInfo || usageInfo)"
          class="review-strip"
        >
          <span class="review-strip__icon">
            <Icon icon="mdi:clipboard-check-outline" />
          </span>
          <span
            v-if="reviewInfo"
            class="review-strip__item"
          >{{ reviewInfo.durationLabel }}</span>
          <span
            v-if="reviewInfo"
            class="review-strip__item"
          >业务工具 {{ reviewInfo.toolCount }}</span>
          <span
            v-if="reviewInfo?.controlCount"
            class="review-strip__item"
          >控制操作 {{ reviewInfo.controlCount }}</span>
          <span
            v-if="reviewInfo?.contextCount"
            class="review-strip__item"
          >上下文操作 {{ reviewInfo.contextCount }}</span>
          <span
            v-if="usageInfo"
            class="review-strip__item"
          >输入 {{ usageInfo.input }}</span>
          <span
            v-if="usageInfo"
            class="review-strip__item"
          >输出 {{ usageInfo.output }}</span>
          <span
            v-if="usageInfo"
            class="review-strip__item"
          >总计 {{ usageInfo.total }}</span>
          <span
            v-if="usageInfo?.cachedInput"
            class="review-strip__item"
          >缓存输入 {{ usageInfo.cachedInput }}</span>
          <span
            v-if="usageInfo?.reasoning"
            class="review-strip__item"
          >推理 {{ usageInfo.reasoning }}</span>
          <span
            v-if="usageInfo?.finishReason"
            class="review-strip__item"
          >{{ usageInfo.finishReason }}</span>
          <span
            v-if="usageInfo?.cumulative && usageInfo.cumulative.turnCount > 1"
            class="review-strip__item review-strip__item--cumulative"
            :title="`累计 ${usageInfo.cumulative.turnCount} 轮对话：输入 ${usageInfo.cumulative.input} / 输出 ${usageInfo.cumulative.output}${usageInfo.cumulative.cachedInput ? ' / 缓存输入 ' + usageInfo.cumulative.cachedInput : ''}${usageInfo.cumulative.reasoning ? ' / 推理 ' + usageInfo.cumulative.reasoning : ''}`"
          >累计 {{ usageInfo.cumulative.total }}</span>
          <span
            v-if="reviewInfo?.failureCount > 0"
            class="review-strip__item review-strip__item--danger"
          >失败 {{ reviewInfo.failureCount }}</span>
        </div>

        <!-- ── Copy all button (for pure-narration turns) ─────────── -->
        <div
          v-if="!msg.loading && finalNarrationContent"
          class="copy-all-row"
        >
          <button
            class="copy-all-btn"
            :class="{ 'copy-all-btn--done': copyAllDone }"
            :title="copyAllDone ? '已复制' : '复制全文'"
            @click="copyAll"
          >
            <Icon :icon="copyAllDone ? 'mdi:check' : 'mdi:content-copy'" />
            {{ copyAllDone ? '已复制' : '复制' }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { formatElapsedLabel } from '@/utils/ai.js'
import { formatRuntimeMs } from '@/utils/aiRuntime.js'
import { groupConsecutiveToolNodes, isInternalToolNode } from '@/utils/aiProcessPresentation.js'
// aiTurnModel node factories are no longer needed here — nodes are built upstream
import TaskNode from './TaskNode.vue'
import AiUserInputCard from './AiUserInputCard.vue'

const props = defineProps({
  msg: {
    type: Object,
    required: true
  },
  /** puppet sessionId — 工具结果旁"追加到摘要"按钮需要；平台 AI 不传。 */
  sessionId: {
    type: String,
    default: null
  },
  /** 当前线程 ID — 计划预批准等操作需要。 */
  threadId: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['retry', 'apply-action', 'answer-user-input'])

// ── Task Tree nodes（过滤掉 plan 节点，plan 由 PlanProgressBar + PlanPanel 展示）
const nodes = computed(() => Array.isArray(props.msg?.nodes) ? props.msg.nodes : [])
const isContinuation = computed(() => Boolean(props.msg?.answerToQuestionId))
const hasUserInput = computed(() => nodes.value.some(node => node?.kind === 'user_input'))
const visibleNodes = computed(() => (
  groupConsecutiveToolNodes(nodes.value.filter(node => {
    if (node.kind === 'plan' || node.kind === 'user_input') return false
    if (isInternalToolNode(node)) return false
    // 问题卡片已经完整表达问题与选项，不再展示模型生成的重复说明。
    return !hasUserInput.value || !['text', 'narration'].includes(node.kind)
  }))
))
const userInputRequests = computed(() => nodes.value.filter(node => node?.kind === 'user_input'))
const pendingUserInput = computed(() => (
  [...userInputRequests.value].reverse().find(node => ['pending', 'answering'].includes(node.status)) || null
))
const isAnswering = computed(() => pendingUserInput.value?.status === 'answering')

function answerUserInput(answer) {
  const value = String(answer || '').trim()
  if (!pendingUserInput.value?.questionId || !value) return
  if (isAnswering.value) return
  emit('answer-user-input', {
    questionId: pendingUserInput.value.questionId,
    answer: value
  })
}

const processExpanded = ref(false)
const processKinds = new Set(['thinking', 'tool', 'tool-group', 'subtask'])
const turnFinished = computed(() => {
  const status = String(props.msg?.status ?? '').toLowerCase()
  return !props.msg?.loading && !['working', 'running', 'streaming'].includes(status)
})
const lastProcessIndex = computed(() => {
  let result = -1
  visibleNodes.value.forEach((node, index) => {
    if (processKinds.has(node.kind)) result = index
  })
  return result
})
const shouldArchiveProcess = computed(() => turnFinished.value && lastProcessIndex.value >= 0)
const archivedProcessNodes = computed(() => (
  shouldArchiveProcess.value ? visibleNodes.value.slice(0, lastProcessIndex.value + 1) : []
))
const conclusionNodes = computed(() => (
  shouldArchiveProcess.value ? visibleNodes.value.slice(lastProcessIndex.value + 1) : visibleNodes.value
))
const processSummary = computed(() => {
  let thinkingCount = 0
  let toolCount = 0
  let controlCount = 0
  let contextCount = 0
  const countTool = (node) => {
    if (isInternalToolNode(node)) return
    if (node.businessTool !== false) toolCount += 1
    else if (node.toolKind === 'CONTROL') controlCount += 1
    else contextCount += 1
  }
  archivedProcessNodes.value.forEach((node) => {
    if (node.kind === 'thinking') thinkingCount += 1
    if (node.kind === 'tool') countTool(node)
    if (node.kind === 'tool-group') {
      for (const child of node.children || []) countTool(child)
    }
  })
  return [
    toolCount ? `${toolCount} 个业务工具` : '',
    controlCount ? `${controlCount} 个控制操作` : '',
    contextCount ? `${contextCount} 个上下文操作` : '',
    thinkingCount ? `${thinkingCount} 次思考` : ''
  ]
    .filter(Boolean)
    .join(' · ')
})

// 用于"复制全文"按钮 - 只有纯文本式（全是 text/narration 节点）时显示
const finalNarrationContent = computed(() => {
  if (hasUserInput.value) return ''
  const n = nodes.value
  const isVisible = (x) => x.kind === 'text' || x.kind === 'narration'
  if (n.length === 1 && isVisible(n[0]) && !n[0].streaming) {
    return n[0].content
  }
  // multi-node: only copy when every node is text/narration
  const visible = n.filter((x) => isVisible(x) && x.content.trim())
  return visible.length === n.length && visible.length > 0
    ? visible.map((x) => x.content).join('\n\n')
    : ''
})

// ── Copy all ──────────────────────────────────────────────────────
const errorMessage = computed(() =>
  props.msg?.errorMeta?.message ?? '请求失败，可点击重试'
)

const errorActions = computed(() => {
  const actions = props.msg?.errorMeta?.actions
  return Array.isArray(actions) ? actions.filter((a) => a?.label).slice(0, 3) : []
})

function handleErrorAction(action) {
  if (action?.code === 'retry') { emit('retry', props.msg); return }
  emit('apply-action', action?.label ?? '')
}

function errorActionIcon(code) {
  if (code === 'retry' || code === 'retry_later')                   return 'mdi:refresh'
  if (code === 'switch_channel' || code === 'switch_tool_channel')  return 'mdi:swap-horizontal'
  if (code === 'probe_channel')                                      return 'mdi:stethoscope'
  if (code === 'edit_api_key' || code === 'edit_model')             return 'mdi:pencil-outline'
  if (code === 'check_network')                                      return 'mdi:access-point-network'
  return 'mdi:lightbulb-outline'
}

// ── Review / usage ────────────────────────────────────────────────
const reviewInfo = computed(() => {
  const review = props.msg?.review
  if (!review || typeof review !== 'object') return null
  const durationMs = Number(review.durationMs ?? 0)
  return {
    durationLabel: durationMs > 0 ? formatRuntimeMs(durationMs) : '已完成',
    toolCount:     Number(review.toolCount ?? 0),
    controlCount:  Number(review.controlCount ?? 0),
    contextCount:  Number(review.contextCount ?? 0),
    failureCount:  Number(review.failureCount ?? 0)
  }
})

const usageInfo = computed(() => {
  const usage = props.msg?.usage ?? props.msg?.review?.usage ?? props.msg?.runtime?.usage
  if (!usage || typeof usage !== 'object') return null
  const input        = Number(usage.inputTokens ?? 0)
  const output       = Number(usage.outputTokens ?? 0)
  const cachedInput  = Number(usage.cachedInputTokens ?? 0)
  const reasoning    = Number(usage.reasoningTokens ?? 0)
  const total        = Number(usage.totalTokens ?? (input + output))
  if (!total && !cachedInput && !reasoning && !usage.finishReason) return null
  const cum = usage.cumulative
  return {
    input, output, cachedInput, reasoning, total,
    finishReason: usage.finishReason ? String(usage.finishReason) : null,
    cumulative: cum ? {
      input:       Number(cum.inputTokens ?? 0),
      output:      Number(cum.outputTokens ?? 0),
      total:       Number(cum.totalTokens ?? 0),
      cachedInput: Number(cum.cachedInputTokens ?? 0),
      reasoning:   Number(cum.reasoningTokens ?? 0),
      turnCount:   Number(cum.turnCount ?? 0)
    } : null
  }
})

// ── Copy all ──────────────────────────────────────────────────────
const copyAllDone = ref(false)
let copyTimer = null

function copyAll() {
  const text = finalNarrationContent.value
  if (!text) return
  navigator.clipboard.writeText(text).then(() => {
    copyAllDone.value = true
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => { copyAllDone.value = false }, 2000)
  })
}

onUnmounted(() => clearTimeout(copyTimer))
</script>

<style scoped>
/* ══ Layout ═══════════════════════════════════════════════════════ */
.turn {
  width: 100%;
}

.turn-assistant {
  background: transparent;
}

.turn-inner {
  max-width: var(--thread-max, 48rem);
  margin: 0 auto;
  padding: 8px 10px 16px;
}

.assistant-wrap {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 11px;
  padding: 8px 2px 14px;
}

.turn-assistant--user-input .turn-inner {
  padding-bottom: 2px;
}

.turn-assistant--user-input .assistant-wrap {
  padding-bottom: 4px;
}

.turn-assistant--continuation .turn-inner,
.turn-assistant--continuation .assistant-wrap {
  padding-top: 0;
}

/* ══ Header ═══════════════════════════════════════════════════════ */
.turn-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ai-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px 3px 6px;
  background: color-mix(in srgb, var(--el-color-primary) 8%, transparent);
  border: 0;
  border-radius: 20px;
  color: var(--el-color-primary);
  font-size: 11px;
  font-weight: 600;
}

.ai-badge-icon {
  font-size: 14px;
}

.turn-elapsed {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  margin-left: auto;
}

.status-pulse {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--el-color-success);
  flex-shrink: 0;
  animation: ai-pulse 1.4s ease-in-out infinite;
}

@keyframes ai-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.4; transform: scale(0.7); }
}

/* ══ Divider ══════════════════════════════════════════════════════ */
.assistant-divider {
  display: none;
}

/* ══ Task Tree ════════════════════════════════════════════════════ */
.task-tree {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.process-archive {
  margin: 1px 0 7px;
  color: var(--el-text-color-secondary);
}

.process-archive__toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 30px;
  padding: 4px 2px;
  border: 0;
  border-radius: 6px;
  color: inherit;
  background: transparent;
  font-size: 11px;
  text-align: left;
  cursor: pointer;
}

.process-archive__toggle:hover {
  color: var(--el-text-color-primary);
  background: color-mix(in srgb, var(--el-text-color-primary) 2.5%, transparent);
}

.process-archive__icon { color: var(--el-text-color-placeholder); font-size: 13px; }
.process-archive__toggle small { margin-left: auto; color: var(--el-text-color-placeholder); font-size: 10px; }

.process-archive__body {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 3px;
}

.final-conclusion {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 4px;
}

.final-conclusion__label {
  color: var(--el-text-color-secondary);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: .02em;
}

.final-conclusion :deep(.task-node--text) {
  margin-left: 0;
  padding: 5px 0 3px;
  border-left: 0;
}

.final-conclusion :deep(.task-node--text .node-content) {
  color: var(--el-text-color-primary);
  font-size: 14.5px;
  font-weight: 400;
  line-height: 1.76;
}

/* ══ Loading skeleton ═════════════════════════════════════════════ */
.assistant-loading {
  padding: 10px 12px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--el-bg-color-overlay) 94%, transparent);
  border: 1px solid color-mix(in srgb, var(--el-text-color-primary) 7%, transparent);
}

.assistant-loading :deep(.el-skeleton) {
  --el-skeleton-color: color-mix(in srgb, var(--el-text-color-primary) 8%, transparent);
  --el-skeleton-to-color: color-mix(in srgb, var(--el-text-color-primary) 14%, transparent);
}

.loading-hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

/* ══ Error bar ════════════════════════════════════════════════════ */
.error-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--el-color-danger) 6%, transparent);
  border: 0;
}

.error-icon {
  color: var(--el-color-danger);
  font-size: 14px;
  flex-shrink: 0;
}

.error-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  flex: 1;
}

.retry-btn {
  color: var(--el-color-danger);
  padding: 2px 8px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 3px;
}

.error-action-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: -2px;
}

.error-action-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 28px;
  padding: 5px 9px;
  border-radius: 7px;
  border: 0;
  background: color-mix(in srgb, var(--el-color-danger) 5%, transparent);
  color: var(--el-color-danger);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.14s, border-color 0.14s;
}

.error-action-chip:hover {
  background: color-mix(in srgb, var(--el-color-danger) 9%, transparent);
  border-color: color-mix(in srgb, var(--el-color-danger) 32%, transparent);
}

/* ══ Review strip ═════════════════════════════════════════════════ */
.review-strip {
  min-height: 24px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.review-strip__icon {
  color: var(--el-color-success);
  font-size: 15px;
  display: inline-flex;
  align-items: center;
}

.review-strip__item {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.review-strip__item--danger     { color: var(--el-color-danger); }
.review-strip__item--cumulative { color: var(--el-color-primary); font-weight: 600; }

/* ══ Copy all ═════════════════════════════════════════════════════ */
.copy-all-row {
  display: flex;
  justify-content: flex-end;
  margin-top: -4px;
}

.copy-all-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 9px;
  border-radius: 6px;
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  cursor: pointer;
  background: color-mix(in srgb, var(--el-text-color-primary) 6%, transparent);
  border: 1px solid color-mix(in srgb, var(--el-text-color-primary) 12%, transparent);
  color: var(--el-text-color-secondary);
  line-height: 1.6;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.copy-all-btn:hover {
  background: color-mix(in srgb, var(--el-text-color-primary) 12%, transparent);
  color: var(--el-text-color-primary);
}

.copy-all-btn--done {
  color: var(--el-color-success);
  border-color: color-mix(in srgb, var(--el-color-success) 30%, transparent);
  background: color-mix(in srgb, var(--el-color-success) 8%, transparent);
}

/* ══ Responsive ═══════════════════════════════════════════════════ */
@media (max-width: 768px) {
  .turn-inner {
    padding: 8px 10px 14px;
  }
}
</style>
