/**
 * Task Tree 数据模型：Node 类型定义 + 工厂函数 + 树操作 helper
 *
 * 核心思想：AI 助理每次输出都是树中的一个 typed Node。
 *  - narration : 叙述文本（AI 直接生成的文字）
 *  - thinking  : 思考过程（扩展/折叠）
 *  - tool      : 工具调用（显示 name / args / result）
 *  - subtask   : 子 Agent 派发（可嵌套 children）
 *  - plan      : 计划（含步骤列表）
 *
 * Turn 是一个对话轮次容器，包含顶层 nodes 数组。
 * 节点通过 id 全局唯一，subtask 节点通过 invocationId 关联后端子 Agent。
 */

// ── 常量 ─────────────────────────────────────────────────────────────

const NODE_KIND = Object.freeze({
  NARRATION: 'narration',
  TEXT:      'text',
  THINKING:  'thinking',
  TOOL:      'tool',
  PLAN:      'plan',
  SUBTASK:   'subtask',
  USER_INPUT:'user_input'
})

export const TOOL_STATUS = Object.freeze({
  PENDING: 'pending',
  RUNNING: 'running',
  DONE:    'done',
  FAILED:  'failed'
})

const STEP_STATUS = Object.freeze({
  PENDING:   'PENDING',
  RUNNING:   'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED:    'FAILED',
  SKIPPED:   'SKIPPED'
})

export function normalizePlanStepStatus(status) {
  if (status === 'IN_PROGRESS') return STEP_STATUS.RUNNING
  return status ?? STEP_STATUS.PENDING
}

// ── ID 生成 ───────────────────────────────────────────────────────────

let _nodeSeq = 0
function nextNodeId(kind) {
  _nodeSeq += 1
  return `${kind}-${Date.now()}-${_nodeSeq}`
}

// ── Node 工厂 ─────────────────────────────────────────────────────────

export function createNarrationNode(opts = {}) {
  return {
    kind:      NODE_KIND.NARRATION,
    id:        nextNodeId(NODE_KIND.NARRATION),
    content:   String(opts.content ?? ''),
    streaming: !!opts.streaming,
    seq:       Number(opts.seq ?? 0),
    createdAt: Date.now()
  }
}

/**
 * 创建一个流式文本段节点。语义上代表 "AI 在思考/工具调用之间产出的可见正文片段"。
 * narration 用于完整结论，text 用于思考与工具调用之间的正文片段。
 */
export function createTextNode(opts = {}) {
  return {
    kind:      NODE_KIND.TEXT,
    id:        nextNodeId(NODE_KIND.TEXT),
    content:   String(opts.content ?? ''),
    streaming: !!opts.streaming,
    seq:       Number(opts.seq ?? 0),
    createdAt: Date.now()
  }
}

export function createThinkingNode(opts = {}) {
  return {
    kind:      NODE_KIND.THINKING,
    id:        nextNodeId(NODE_KIND.THINKING),
    content:   String(opts.content ?? ''),
    summary:   opts.summary ?? null,
    seq:       Number(opts.seq ?? 0),
    createdAt: Date.now()
  }
}

export function createToolNode(opts = {}) {
  return {
    kind:          NODE_KIND.TOOL,
    id:            nextNodeId(NODE_KIND.TOOL),
    name:          String(opts.name ?? ''),
    toolCallId:    opts.toolCallId ?? null,
    args:          opts.args ?? null,
    status:        opts.status ?? TOOL_STATUS.PENDING,
    result:        opts.result ?? null,
    error:         opts.error ?? null,
    success:       opts.success ?? null,
    category:      opts.category ?? null,
    toolKind:      opts.toolKind ?? null,
    businessTool:  opts.businessTool !== false,
    terminal:      opts.terminal === true,
    exclusive:     opts.exclusive === true,
    planStepIndex: opts.planStepIndex >= 0 ? opts.planStepIndex : null,
    seq:           Number(opts.seq ?? 0),
    startTime:     opts.startTime ?? Date.now(),
    endTime:       opts.endTime ?? null,
    createdAt:     Date.now(),
    updatedAt:     Date.now()
  }
}

export function createSubtaskNode(opts = {}) {
  return {
    kind:         NODE_KIND.SUBTASK,
    id:           nextNodeId(NODE_KIND.SUBTASK),
    invocationId: opts.invocationId ?? null,
    childThreadId: opts.childThreadId ?? null,
    sessionId:    opts.sessionId ?? null,
    puppetId:     opts.puppetId ?? null,
    task:         String(opts.task ?? 'Puppet AI 子任务'),
    status:       opts.status ?? 'pending',
    summary:      opts.summary ?? null,
    children:     Array.isArray(opts.children) ? opts.children : [],
    plan:         opts.plan ?? null,
    seq:          Number(opts.seq ?? 0),
    createdAt:    Number(opts.createdAt ?? Date.now()),
    completedAt:  opts.completedAt ?? null,
    updatedAt:    Date.now()
  }
}

export function createUserInputNode(opts = {}) {
  return {
    kind:          NODE_KIND.USER_INPUT,
    id:            nextNodeId(NODE_KIND.USER_INPUT),
    questionId:    opts.questionId ?? null,
    type:          opts.type ?? 'CLARIFICATION',
    prompt:        String(opts.prompt ?? ''),
    options:       Array.isArray(opts.options)
      ? opts.options.map(option => ({
        label: String(option?.label ?? ''),
        value: String(option?.value ?? ''),
        intent: String(option?.intent ?? '')
      })).filter(option => option.label && option.value).slice(0, 4)
      : [],
    allowFreeText: opts.allowFreeText === true,
    actionSummary: opts.actionSummary ?? null,
    toolName:      opts.toolName ?? null,
    argumentsHash: opts.argumentsHash ?? null,
    risk:          opts.risk ?? 'LOW',
    status:        opts.status ?? 'pending',
    answer:        opts.answer ?? null,
    expiresAt:     opts.expiresAt ?? null,
    seq:           Number(opts.seq ?? 0),
    createdAt:     Number(opts.createdAt ?? Date.now()),
    updatedAt:     Date.now()
  }
}

export function findSubtask(nodes, invocationId) {
  if (!invocationId) return null
  return nodes.find(node => node.kind === NODE_KIND.SUBTASK && node.invocationId === invocationId) ?? null
}

function normalizePlanStep(step, fallbackIndex = 0) {
  return {
    index:          Number(step?.index ?? fallbackIndex),
    description:    step?.description ?? '',
    toolHint:       step?.toolHint ?? '',
    parallel:       !!step?.parallel,
    successCriteria:step?.successCriteria ?? '',
    maxRetries:     Number(step?.maxRetries ?? 1),
    dependsOn:      Array.isArray(step?.dependsOn) ? step.dependsOn : [],
    status:         normalizePlanStepStatus(step?.status),
    result:         step?.result ?? '',
    reason:         step?.reason ?? '',
    startedAt:      Number(step?.startedAt ?? 0),
    completedAt:    Number(step?.completedAt ?? 0)
  }
}

/**
 * 将服务端传来的 plan 数据规范化为前端 PlanBar / TaskNode 需要的统一形状。
 * @param plan 原始 plan 对象（可能来自 SSE 事件或历史消息恢复）
 * @param seq  事件序号（仅当来自 SSE 时有效）
 * @returns 规范化 plan 快照，输入无效则返回 null
 */
export function normalizePlan(plan, seq = 0) {
  if (!plan || typeof plan !== 'object') return null
  return {
    planId: plan.planId || '',
    title: plan.title || '未命名计划',
    goal: plan.goal || '',
    status: plan.status || 'PLANNING',
    finalSummary: plan.finalSummary || '',
    createdAt: Number(plan.createdAt || Date.now()),
    updatedAt: Number(plan.updatedAt || Date.now()),
    steps: Array.isArray(plan.steps)
      ? plan.steps.map((step, index) => normalizePlanStep(step, index))
      : [],
    seq: Number(seq || 0)
  }
}

// ── 树操作 helper ─────────────────────────────────────────────────────

/**
 * 封闭末尾 live narration（结束流式输出）。
 * 空内容时从数组移除。
 */
function sealLiveNarration(nodes) {
  const last = nodes[nodes.length - 1]
  if (!last || last.kind !== NODE_KIND.NARRATION || !last.streaming) return
  const trimmed = last.content.trim()
  if (!trimmed) {
    nodes.pop()
    return
  }
  last.content  = trimmed
  last.streaming = false
}

/**
 * 获取或创建位于 nodes 数组末尾的 live text node（用于 delta 累积阶段）。
 * 若末尾不是 streaming text，则新建并 push。
 */
export function getLiveText(nodes) {
  const last = nodes[nodes.length - 1]
  if (last?.kind === NODE_KIND.TEXT && last.streaming) return last
  const node = createTextNode({ streaming: true })
  nodes.push(node)
  return node
}

/**
 * 封闭末尾 live text node（在 thinking / tool / complete 边界由 node{kind:"text"} 触发）。
 * 空内容时从数组移除。
 */
function sealLiveText(nodes) {
  const last = nodes[nodes.length - 1]
  if (!last || last.kind !== NODE_KIND.TEXT || !last.streaming) return
  const trimmed = last.content.trim()
  if (!trimmed) {
    nodes.pop()
    return
  }
  last.content  = trimmed
  last.streaming = false
}

/** 同时 seal 末尾的 live narration 或 live text，调用方不必关心是哪种。 */
export function sealLiveTextOrNarration(nodes) {
  const last = nodes[nodes.length - 1]
  if (!last || !last.streaming) return
  if (last.kind === NODE_KIND.NARRATION) return sealLiveNarration(nodes)
  if (last.kind === NODE_KIND.TEXT)      return sealLiveText(nodes)
}

/**
 * 在 nodes 中按 toolCallId（优先）或 name+seq 找到 tool node。
 */
export function findTool(nodes, { toolCallId, name, seq }) {
  for (const node of nodes) {
    if (node.kind !== NODE_KIND.TOOL) continue
    if (toolCallId && node.toolCallId === String(toolCallId)) return node
    if (!toolCallId && node.name === name && node.seq === Number(seq)) return node
  }
  return null
}
