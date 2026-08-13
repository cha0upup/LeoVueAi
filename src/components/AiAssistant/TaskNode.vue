<!-- eslint-disable vue/no-v-html -->
<template>
  <!-- ── narration（完整结论文本） ───────────────────────────── -->
  <div
    v-if="node.kind === 'narration'"
    class="task-node task-node--narration"
  >
    <div
      ref="narrationRef"
      class="node-content msg-md"
      @click="onNarrationClick"
      v-html="renderAssistantMarkdown(node.content)"
    />
    <span
      v-if="node.streaming"
      class="stream-cursor"
      aria-hidden="true"
    />
  </div>

  <!-- ── text（思考/工具之间的中间正文段，弱化样式） ───────────── -->
  <div
    v-else-if="node.kind === 'text'"
    class="task-node task-node--text"
  >
    <div
      ref="narrationRef"
      class="node-content msg-md"
      @click="onNarrationClick"
      v-html="renderAssistantMarkdown(node.content)"
    />
    <span
      v-if="node.streaming"
      class="stream-cursor"
      aria-hidden="true"
    />
  </div>

  <!-- ── thinking ────────────────────────────────────────────── -->
  <div
    v-else-if="node.kind === 'thinking'"
    class="task-node task-node--thinking"
  >
    <button
      class="node-toggle"
      @click="open = !open"
    >
      <Icon
        :icon="open ? 'mdi:chevron-down' : 'mdi:chevron-right'"
        class="expand-chevron"
      />
      <span class="process-icon process-icon--thinking">
        <Icon icon="mdi:brain" />
      </span>
      <span class="process-main">
        <span class="process-title">思考</span>
        <span
          v-if="thinkingPeek"
          class="process-caption"
        >{{ thinkingPeek }}</span>
      </span>
      <span
        v-if="node.streaming"
        class="process-status is-primary"
      >思考中</span>
    </button>
    <div
      v-if="open"
      class="thinking-body"
    >
      <pre class="thinking-text">{{ node.content }}</pre>
    </div>
  </div>

  <!-- ── tool group ──────────────────────────────────────────── -->
  <div
    v-else-if="node.kind === 'tool-group'"
    class="task-node task-node--tool task-node--tool-group is-success"
  >
    <button
      type="button"
      class="tool-header"
      @click="open = !open"
    >
      <Icon
        :icon="open ? 'mdi:chevron-down' : 'mdi:chevron-right'"
        class="expand-chevron"
      />
      <span class="process-icon is-success">
        <Icon :icon="toolKindIcon" />
      </span>
      <span class="process-main">
        <span class="process-title tool-name">{{ toolDisplayName }}</span>
        <span class="process-caption">连续 {{ visibleChildren.length }} 次调用</span>
      </span>
      <span class="process-status is-success">完成</span>
    </button>
    <div
      v-if="open"
      class="tool-group-body"
    >
      <TaskNode
        v-for="child in visibleChildren"
        :key="child.id"
        :node="child"
        :collapse-process="collapseProcess"
      />
    </div>
  </div>

  <!-- ── tool ────────────────────────────────────────────────── -->
  <div
    v-else-if="node.kind === 'tool'"
    class="task-node task-node--tool"
    :class="`is-${toolTone}`"
  >
    <button
      type="button"
      class="tool-header"
      @click="open = !open"
    >
      <Icon
        :icon="open ? 'mdi:chevron-down' : 'mdi:chevron-right'"
        class="expand-chevron"
      />
      <span
        class="process-icon"
        :class="`is-${toolTone}`"
      >
        <Icon :icon="toolKindIcon" />
      </span>
      <span class="process-main">
        <span
          class="process-title tool-name"
          :title="node.name"
        >{{ toolDisplayName }}</span>
        <span
          v-if="toolCaption"
          class="process-caption"
        >{{ toolCaption }}</span>
      </span>
      <span
        class="process-status"
        :class="`is-${toolTone}`"
      >
        {{ toolStatusLabel }}
      </span>
    </button>
    <TaskToolDetails
      v-if="open"
      :node="node"
    />
  </div>

  <!-- ── subtask（平台 AI 委派给 Puppet AI）────────────────────── -->
  <div
    v-else-if="node.kind === 'subtask'"
    class="task-node task-node--subtask"
    :class="`is-${subtaskTone}`"
  >
    <button
      class="subtask-header"
      @click="open = !open"
    >
      <span
        class="process-icon"
        :class="`is-${subtaskTone}`"
      >
        <Icon icon="mdi:robot-outline" />
      </span>
      <span class="process-main">
        <span class="process-title">Puppet AI 子任务</span>
        <span class="process-caption">{{ node.puppetId || node.task }}</span>
      </span>
      <span
        class="process-status"
        :class="`is-${subtaskTone}`"
      >{{ subtaskStatusLabel }}</span>
      <Icon
        :icon="open ? 'mdi:chevron-up' : 'mdi:chevron-down'"
        class="expand-chevron"
      />
    </button>
    <div
      v-if="open"
      class="subtask-body"
    >
      <div class="subtask-task">
        {{ node.task }}
      </div>
      <div
        v-if="visibleChildren.length"
        class="subtask-timeline"
      >
        <TaskNode
          v-for="child in visibleChildren"
          :key="child.id"
          :node="child"
          :collapse-process="collapseProcess"
          @answer-user-input="$emit('answer-user-input', $event)"
        />
      </div>
      <div
        v-if="node.summary && node.status !== 'running'"
        class="subtask-summary msg-md"
        v-html="renderAssistantMarkdown(node.summary)"
      />
    </div>
  </div>

  <!-- 子 Agent 的输入请求先作为状态节点展示；回答路由需要 childThreadId 专用接口。 -->
  <div
    v-else-if="node.kind === 'user_input'"
    class="task-node task-node--subtask-input"
  >
    <Icon icon="mdi:shield-alert-outline" />
    <span>{{ node.type === 'CONFIRMATION' ? '子 Puppet AI 正在等待操作确认' : '子 Puppet AI 正在等待补充信息' }}</span>
  </div>
</template>

<script setup>
import { computed, inject, nextTick, onUnmounted, ref, watch } from 'vue'
import { renderAssistantMarkdown } from '@/utils/ai.js'
import {
  getToolDisplayName,
  isInternalToolNode,
  summarizeToolNode
} from '@/utils/aiProcessPresentation.js'
import { getShellResultApi } from '@/services/api/shell-generator.js'
import TaskToolDetails from './TaskToolDetails.vue'
import {
  getInitialNodeOpenState,
  getSubtaskPresentation,
  getThinkingPeek,
  getToolKindIcon,
  getToolStatusLabel,
  getToolTone
} from './taskNodeModel.js'

// Tool chip click — delegate via event bubbling on the narration div
const switchTab = inject('switchTab', null)
const narrationRef = ref(null)
const resetTimers = new Set()
let inlineRequestGeneration = 0

const scheduleButtonReset = (button, label, removeDoneClass = false) => {
  const timer = window.setTimeout(() => {
    resetTimers.delete(timer)
    if (!button.isConnected) return
    button.textContent = label
    if (removeDoneClass) button.classList.remove('copy-btn--done')
  }, 2000)
  resetTimers.add(timer)
}

const copyButtonContent = async (button, content, doneLabel = '已复制') => {
  try {
    const clipboard = globalThis.navigator?.clipboard
    if (typeof clipboard?.writeText !== 'function') throw new Error('clipboard unavailable')
    await clipboard.writeText(content)
    button.textContent = doneLabel
    button.classList.add('copy-btn--done')
    scheduleButtonReset(button, '复制', true)
  } catch {
    button.textContent = '失败'
    scheduleButtonReset(button, '复制')
  }
}

async function onNarrationClick(e) {
  const target = e.target
  if (!target || typeof target.closest !== 'function') return

  const copyButton = target.closest('.copy-btn')
  if (copyButton) {
    const code = copyButton.parentElement?.querySelector('code')?.textContent || ''
    await copyButtonContent(copyButton, code)
    return
  }

  const inlineCopyButton = target.closest('.ai-shell-inline-copy')
  if (inlineCopyButton) {
    const code = inlineCopyButton.closest('.ai-shell-inline-result')
      ?.querySelector('.ai-shell-inline-code')?.textContent || ''
    await copyButtonContent(inlineCopyButton, code)
    return
  }

  // tool chip
  const chip = target.closest('.ai-tool-chip')
  if (chip) {
    const key = chip.dataset.toolKey
    if (key && switchTab) switchTab(key)
    return
  }

  // shell result chip
  const shellChip = target.closest('.ai-shell-chip')
  if (shellChip) {
    await handleShellChipClick(shellChip)
  }
}

async function handleShellChipClick(btn) {
  const resultId = btn.dataset.shellResultId
  if (!resultId) return

  const existing = btn.nextElementSibling?.matches('.ai-shell-inline-result')
    ? btn.nextElementSibling
    : null
  if (existing) {
    existing.hidden = !existing.hidden
    const iconEl = btn.querySelector('.ai-shell-chip__icon')
    const labelEl = btn.querySelector('.ai-shell-chip__label')
    if (iconEl) iconEl.textContent = existing.hidden ? '⬇' : '▲'
    if (labelEl) labelEl.textContent = existing.hidden ? '展开代码' : '收起代码'
    return
  }

  // 防止重复点击
  if (btn.dataset.loading === 'true') return
  btn.dataset.loading = 'true'
  const labelEl = btn.querySelector('.ai-shell-chip__label')
  const origText = labelEl?.textContent ?? '取回完整代码'
  if (labelEl) labelEl.textContent = '取回中…'
  const generation = inlineRequestGeneration
  const isCurrentButton = () =>
    generation === inlineRequestGeneration &&
    btn.isConnected &&
    narrationRef.value?.contains(btn)

  try {
    const response = await getShellResultApi(resultId)
    if (!isCurrentButton()) return
    const data = response.data
    const content = data?.content
    if (!content) throw new Error('返回内容为空')

    // 在按钮后注入结果块
    const wrapper = document.createElement('div')
    wrapper.className = 'ai-shell-inline-result'

    const header = document.createElement('div')
    header.className = 'ai-shell-inline-header'

    const lbl = document.createElement('span')
    lbl.className = 'ai-shell-inline-label'
    lbl.textContent = '完整代码'

    const copyBtn = document.createElement('button')
    copyBtn.type = 'button'
    copyBtn.className = 'ai-shell-inline-copy'
    copyBtn.textContent = '复制'

    header.appendChild(lbl)
    header.appendChild(copyBtn)

    const pre = document.createElement('pre')
    pre.className = 'ai-shell-inline-code'
    pre.textContent = content

    wrapper.appendChild(header)
    wrapper.appendChild(pre)
    btn.insertAdjacentElement('afterend', wrapper)

    // 按钮切换为"收起代码"
    const iconEl = btn.querySelector('.ai-shell-chip__icon')
    if (iconEl) iconEl.textContent = '▲'
    if (labelEl) labelEl.textContent = '收起代码'
    btn.dataset.loading = 'false'
  } catch (err) {
    if (!isCurrentButton()) return
    if (labelEl) labelEl.textContent = origText
    btn.dataset.loading = 'false'
    if (btn.nextElementSibling?.matches('.ai-shell-inline-error')) {
      btn.nextElementSibling.remove()
    }
    const errSpan = document.createElement('span')
    errSpan.className = 'ai-shell-inline-error'
    errSpan.textContent = ' 取回失败：' + (err?.message ?? '未知错误')
    btn.insertAdjacentElement('afterend', errSpan)
  }
}

const props = defineProps({
  node: {
    type: Object,
    required: true
  },
  collapseProcess: {
    type: Boolean,
    default: false
  }
})

defineEmits(['answer-user-input'])

// ── Collapsed / expanded state ────────────────────────────────────
// thinking + tool: closed by default; others open
const open = ref(getInitialNodeOpenState(props.node.kind))

watch(
  () => props.node.status,
  (status, previousStatus) => {
    if (props.node.kind !== 'tool') return
    if (status === 'running' || status === 'failed' || props.node.success === false) {
      open.value = true
    } else if (previousStatus === 'running' && status === 'done') {
      open.value = false
    }
  },
  { immediate: true }
)

watch(
  () => props.collapseProcess,
  (collapse) => {
    if (collapse && ['thinking', 'tool', 'tool-group', 'subtask'].includes(props.node.kind)) {
      open.value = false
    }
  },
  { immediate: true, flush: 'post' }
)

function injectCopyButtons(el) {
  if (!el) return
  el.querySelectorAll('pre').forEach((pre) => {
    if (pre.querySelector('.copy-btn')) return
    const code = pre.querySelector('code')
    if (!code) return
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'copy-btn'
    btn.textContent = '复制'
    pre.appendChild(btn)
  })
}

watch(
  () => [props.node.streaming, props.node.content],
  ([streaming]) => {
    inlineRequestGeneration += 1
    if (!streaming && narrationRef.value) {
      nextTick(() => injectCopyButtons(narrationRef.value))
    }
  },
  { flush: 'post', immediate: true }
)

onUnmounted(() => {
  inlineRequestGeneration += 1
  resetTimers.forEach(timer => window.clearTimeout(timer))
  resetTimers.clear()
})

// ── thinking helpers ─────────────────────────────────────────────
const thinkingPeek = computed(() => {
  return getThinkingPeek(props.node.content)
})

// ── tool helpers ─────────────────────────────────────────────────
const toolTone = computed(() => getToolTone(props.node))

const toolDisplayName = computed(() => getToolDisplayName(props.node.name))

const toolCaption = computed(() => {
  const summary = summarizeToolNode(props.node)
  const step = props.node.planStepIndex != null ? `步骤 ${props.node.planStepIndex + 1}` : ''
  return [summary, step].filter(Boolean).join(' · ')
})

const toolKindIcon = computed(() => getToolKindIcon(props.node.name))

const toolStatusLabel = computed(() => getToolStatusLabel(props.node))

const subtaskPresentation = computed(() => getSubtaskPresentation(props.node.status))
const subtaskTone = computed(() => subtaskPresentation.value.tone)
const subtaskStatusLabel = computed(() => subtaskPresentation.value.label)
const visibleChildren = computed(() => (
  Array.isArray(props.node.children)
    ? props.node.children.filter(child => !isInternalToolNode(child))
    : []
))

</script>

<style scoped>
/* ══ 通用结构 ═══════════════════════════════════════════════════════ */
.task-node {
  width: 100%;
}

/* ══ narration ══════════════════════════════════════════════════════ */
.task-node--narration {
  position: relative;
  padding: 5px 0 3px;
}

.task-node--narration .node-content {
  color: var(--el-text-color-primary);
  font-size: 14.5px;
  font-weight: 400;
  line-height: 1.76;
}

/* ══ text（中间段，弱化排版） ════════════════════════════════════════ */
.task-node--text {
  position: relative;
  margin-left: 2px;
  padding-left: 13px;
  border-left: 2px solid color-mix(in srgb, var(--el-border-color) 34%, transparent);
}

.task-node--text .node-content {
  color: var(--el-text-color-regular);
  font-size: 14px;
  font-weight: 400;
  line-height: 1.72;
}

/* ══ Puppet AI 子任务 ═══════════════════════════════════════════════ */
.task-node--subtask {
  border: 0;
  border-radius: 12px;
  overflow: hidden;
  background: color-mix(in srgb, var(--el-color-primary) 3%, var(--el-bg-color));
}

.subtask-header {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px;
  border: 0;
  background: transparent;
  color: var(--el-text-color-primary);
  cursor: pointer;
  text-align: left;
}

.subtask-body {
  padding: 2px 10px 10px 49px;
}

.subtask-task {
  padding: 7px 9px;
  border-radius: 6px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-regular);
  font-size: 12px;
  line-height: 1.55;
}

.subtask-timeline {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 9px;
  padding-left: 0;
  border-left: 0;
}

.subtask-summary {
  margin-top: 9px;
  padding-top: 9px;
  border-top: 0;
}

.node-content {
  font-size: 14.5px;
  line-height: 1.8;
  color: var(--el-text-color-primary);
}

/* 流式光标 */
.stream-cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  background: var(--el-color-primary);
  vertical-align: text-bottom;
  margin-left: 1px;
  animation: blink-cursor 0.8s steps(1) infinite;
}

@keyframes blink-cursor {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* ══ thinking ════════════════════════════════════════════════════════ */
.task-node--thinking {
  margin-left: 2px;
  padding-left: 9px;
  border-left: 2px solid color-mix(in srgb, var(--el-color-primary) 18%, transparent);
  opacity: .66;
  transition: opacity .15s ease, border-color .15s ease;
}

.task-node--thinking:hover,
.task-node--thinking:focus-within,
.task-node--thinking:has(.process-status.is-primary) {
  border-left-color: color-mix(in srgb, var(--el-color-primary) 32%, transparent);
  opacity: 1;
}

.node-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 7px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 5px 2px;
  border-radius: 5px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
  text-align: left;
  transition: background .15s ease;
}

.node-toggle:hover {
  color: var(--el-text-color-primary);
  background: color-mix(in srgb, var(--el-text-color-primary) 3%, transparent);
}

.process-icon {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 32px;
  border-radius: 10px;
  color: var(--el-text-color-secondary);
  background: color-mix(in srgb, var(--el-text-color-primary) 6%, transparent);
  font-size: 16px;
}

.process-icon--thinking,
.process-icon.is-primary {
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 9%, transparent);
}

.task-node--thinking .process-icon,
.task-node--tool .process-icon {
  width: 20px;
  height: 20px;
  flex-basis: 20px;
  border-radius: 5px;
  color: var(--el-text-color-placeholder);
  background: transparent;
  font-size: 13px;
}

.task-node--thinking .process-main,
.task-node--tool .process-main {
  flex-direction: row;
  align-items: center;
  gap: 6px;
}

.task-node--thinking .process-title,
.task-node--tool .process-title {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: 550;
}

.task-node--tool .process-title { font-size: 12px; }

.task-node--thinking .process-caption,
.task-node--tool .process-caption {
  flex: 1;
  font-size: 10.5px;
}

.task-node--thinking .process-status,
.task-node--tool .process-status {
  min-height: auto;
  padding: 0;
  color: var(--el-text-color-placeholder);
  background: transparent;
  font-size: 9.5px;
  font-weight: 500;
}

.task-node--tool .process-status { font-size: 11px; }

.task-node--thinking .process-status.is-primary,
.task-node--tool .process-status.is-primary {
  color: var(--el-color-primary);
  background: transparent;
}

.task-node--tool .process-status.is-danger {
  color: var(--el-color-danger);
  background: transparent;
}

.process-icon.is-success {
  color: var(--el-color-success);
  background: color-mix(in srgb, var(--el-color-success) 9%, transparent);
}

.process-icon.is-danger {
  color: var(--el-color-danger);
  background: color-mix(in srgb, var(--el-color-danger) 9%, transparent);
}

.process-main {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.process-title {
  overflow: hidden;
  color: var(--el-text-color-primary);
  font-size: 12px;
  font-weight: 650;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.process-caption {
  overflow: hidden;
  color: var(--el-text-color-placeholder);
  font-size: 10.5px;
  font-weight: 400;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.process-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
  min-height: 22px;
  padding: 0 8px;
  border-radius: 11px;
  color: var(--el-text-color-secondary);
  background: color-mix(in srgb, var(--el-text-color-primary) 5%, transparent);
  font-size: 10px;
  font-weight: 600;
}

.process-status.is-primary { color: var(--el-color-primary); background: color-mix(in srgb, var(--el-color-primary) 8%, transparent); }
.process-status.is-success { color: var(--el-color-success); background: color-mix(in srgb, var(--el-color-success) 8%, transparent); }
.process-status.is-danger { color: var(--el-color-danger); background: color-mix(in srgb, var(--el-color-danger) 8%, transparent); }

.task-node--thinking .process-icon {
  color: color-mix(in srgb, var(--el-color-primary) 68%, var(--el-text-color-placeholder));
  background: transparent;
}

.task-node--tool .process-icon.is-success {
  color: var(--el-text-color-primary);
  background: transparent;
}

.task-node--tool .process-icon.is-primary { color: var(--el-color-primary); background: transparent; }
.task-node--tool .process-icon.is-danger { color: var(--el-color-danger); background: transparent; }
.task-node--tool .process-status.is-success { color: var(--el-color-success); background: transparent; }
.task-node--tool .process-status.is-primary { color: var(--el-color-primary); background: transparent; }
.task-node--tool .process-status.is-danger { color: var(--el-color-danger); background: transparent; }

.thinking-body {
  margin: 2px 4px 7px 34px;
  padding: 4px 0 2px;
  border-radius: 0;
  background: transparent;
}

.thinking-text {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}

/* ══ tool ═══════════════════════════════════════════════════════════ */
.task-node--tool {
  margin-left: 2px;
  padding-left: 9px;
  border: 0;
  border-left: 2px solid color-mix(in srgb, var(--el-border-color) 42%, transparent);
  border-radius: 0;
  background: transparent;
  opacity: .7;
  transition: opacity .15s ease, border-color .15s ease;
}

.task-node--tool:hover,
.task-node--tool:focus-within { opacity: 1; }
.task-node--tool.is-success { border-left-color: color-mix(in srgb, var(--el-color-success) 20%, transparent); }
.task-node--tool.is-primary { border-left-color: color-mix(in srgb, var(--el-color-primary) 34%, transparent); opacity: 1; }
.task-node--tool.is-danger { border-left-color: color-mix(in srgb, var(--el-color-danger) 38%, transparent); opacity: 1; }

.tool-header {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 0;
  padding: 5px 2px;
  border: 0;
  border-radius: 5px;
  color: inherit;
  background: transparent;
  cursor: pointer;
  font-size: 12.5px;
  text-align: left;
  user-select: none;
}

.tool-header:hover {
  background: color-mix(in srgb, var(--el-text-color-primary) 2.5%, transparent);
}

.tool-name {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.tool-group-body {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin: 3px 0 8px 24px;
}

.task-node--tool-group > .tool-header .tool-name {
  font-family: inherit;
}

.expand-chevron {
  font-size: 13px;
  color: var(--el-text-color-placeholder);
  flex-shrink: 0;
}

/* ══ markdown styles（narration node 内部）══════════════════════════ */
.msg-md {
  white-space: normal;
}

.msg-md :deep(h1),
.msg-md :deep(h2),
.msg-md :deep(h3),
.msg-md :deep(h4) {
  margin: 0.7em 0 0.4em;
  font-weight: 600;
  line-height: 1.35;
  color: var(--el-text-color-primary);
}

.msg-md :deep(h1) { font-size: 1.2rem; }
.msg-md :deep(h2) { font-size: 1.1rem; }
.msg-md :deep(h3),
.msg-md :deep(h4) { font-size: 1.02rem; }

.msg-md :deep(p) { margin: 0.5em 0; }
.msg-md :deep(p:first-child) { margin-top: 0; }
.msg-md :deep(p:last-child)  { margin-bottom: 0; }

.msg-md :deep(ul),
.msg-md :deep(ol) { margin: 0.45em 0; padding-left: 1.35em; }

.msg-md :deep(li) { margin: 0.25em 0; }

.msg-md :deep(blockquote) {
  margin: 0.55em 0;
  padding: 0.35em 0 0.35em 0.85em;
  border-left: 3px solid color-mix(in srgb, var(--el-color-primary) 42%, transparent);
  color: var(--el-text-color-regular);
  background: color-mix(in srgb, var(--el-fill-color-light) 90%, transparent);
  border-radius: 0 var(--el-border-radius-small) var(--el-border-radius-small) 0;
}

.msg-md :deep(hr) {
  margin: 0.85em 0;
  border: none;
  border-top: 1px solid var(--el-border-color-lighter);
}

.msg-md :deep(a) {
  color: var(--el-color-primary);
  text-decoration: none;
}

.msg-md :deep(a:hover) { text-decoration: underline; }

.msg-md :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.88em;
  padding: 0.14em 0.38em;
  background: color-mix(in srgb, var(--el-text-color-primary) 6%, transparent);
  border-radius: 5px;
}

.msg-md :deep(pre) {
  position: relative;
  margin: 0.65em 0;
  padding: 10px 12px;
  overflow-x: auto;
  font-size: 12px;
  line-height: 1.5;
  background: color-mix(in srgb, var(--el-text-color-primary) 4%, transparent);
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--el-text-color-primary) 8%, transparent);
}

.msg-md :deep(pre code) {
  padding: 0;
  border: none;
  background: transparent;
  font-size: inherit;
}

.msg-md :deep(.copy-btn) {
  position: absolute;
  top: 7px;
  right: 8px;
  padding: 2px 9px;
  border-radius: 5px;
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  cursor: pointer;
  background: color-mix(in srgb, var(--el-text-color-primary) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--el-text-color-primary) 14%, transparent);
  color: var(--el-text-color-secondary);
  line-height: 1.6;
  transition: background 0.15s, color 0.15s;
  z-index: 1;
}

.msg-md :deep(.copy-btn:hover) {
  background: color-mix(in srgb, var(--el-text-color-primary) 14%, transparent);
  color: var(--el-text-color-primary);
}

.msg-md :deep(.copy-btn--done) {
  color: var(--el-color-success);
  border-color: color-mix(in srgb, var(--el-color-success) 32%, transparent);
  background: color-mix(in srgb, var(--el-color-success) 8%, transparent);
}

.msg-md :deep(table) {
  width: 100%;
  margin: 0.55em 0;
  font-size: 13px;
  border-collapse: collapse;
}

.msg-md :deep(th),
.msg-md :deep(td) {
  border: 1px solid var(--el-border-color);
  padding: 8px 10px;
  text-align: left;
}

.msg-md :deep(th) {
  background: color-mix(in srgb, var(--el-text-color-primary) 5%, transparent);
  font-weight: 600;
}

.msg-md :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 10px;
}

.msg-md :deep(.msg-md-fallback) {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
}

/* ══ AI shell chip（[[shell-result:uuid]] 语法）══════════════════════ */
.msg-md :deep(.ai-shell-chip) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px 2px 7px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--el-color-success) 35%, transparent);
  background: color-mix(in srgb, var(--el-color-success) 10%, transparent);
  color: var(--el-color-success);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  line-height: 1.6;
  vertical-align: middle;
  transition: background 0.15s, border-color 0.15s;
  white-space: nowrap;
}

.msg-md :deep(.ai-shell-chip:hover) {
  background: color-mix(in srgb, var(--el-color-success) 18%, transparent);
  border-color: color-mix(in srgb, var(--el-color-success) 55%, transparent);
}

.msg-md :deep(.ai-shell-chip__icon) {
  font-size: 10px;
  line-height: 1;
}

.msg-md :deep(.ai-shell-inline-result) {
  margin: 8px 0;
  border-radius: 6px;
  border: 1px solid color-mix(in srgb, var(--el-color-success) 20%, transparent);
  overflow: hidden;
}

.msg-md :deep(.ai-shell-inline-header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 10px;
  background: color-mix(in srgb, var(--el-color-success) 6%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--el-color-success) 14%, transparent);
}

.msg-md :deep(.ai-shell-inline-label) {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--el-color-success);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.msg-md :deep(.ai-shell-inline-copy) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid color-mix(in srgb, var(--el-text-color-primary) 14%, transparent);
  background: color-mix(in srgb, var(--el-text-color-primary) 5%, transparent);
  color: var(--el-text-color-secondary);
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  line-height: 1.6;
}

.msg-md :deep(.ai-shell-inline-copy:hover) {
  background: color-mix(in srgb, var(--el-text-color-primary) 10%, transparent);
  color: var(--el-text-color-primary);
}

.msg-md :deep(.ai-shell-inline-code) {
  margin: 0;
  padding: 10px 12px;
  background: color-mix(in srgb, var(--el-text-color-primary) 4%, transparent);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11.5px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 420px;
  overflow-y: auto;
  color: var(--el-text-color-primary);
  border-left: 2px solid color-mix(in srgb, var(--el-color-success) 35%, transparent);
}

.msg-md :deep(.ai-shell-inline-error) {
  font-size: 11.5px;
  color: var(--el-color-danger);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  margin-left: 6px;
}
.msg-md :deep(.ai-tool-chip) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 9px 2px 6px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 28%, transparent);
  background: color-mix(in srgb, var(--el-color-primary) 10%, transparent);
  color: var(--el-color-primary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  line-height: 1.6;
  vertical-align: middle;
  transition: background 0.15s, border-color 0.15s;
  white-space: nowrap;
}

.msg-md :deep(.ai-tool-chip:hover) {
  background: color-mix(in srgb, var(--el-color-primary) 18%, transparent);
  border-color: color-mix(in srgb, var(--el-color-primary) 44%, transparent);
}

.msg-md :deep(.ai-tool-chip__icon) {
  font-size: 11px;
  line-height: 1;
}

</style>
