/**
 * AI 消息工厂：集中创建 assistant / user / system-warn 消息，保证字段形状一致。
 *
 * 设计目标：
 * - 单一处定义 message 的 schema，避免多处零散初始化导致字段不一致
 * - 内部字段统一放在 _internal 命名空间，不污染对外形状
 */

/** Assistant 消息的完整字段集。新增对外字段需在此显式声明默认值。 */
export function createAssistantMessage(overrides = {}) {
  const now = Date.now()
  const startedAt = overrides.startedAt || now
  return {
    id: overrides.id || null,
    turnId: overrides.turnId || null,
    answerToQuestionId: overrides.answerToQuestionId || null,
    role: 'assistant',
    content: '',
    // Task Tree（渲染数据源）
    nodes: [],
    planEvents: [],
    plan: null,
    // 状态类
    loading: true,
    failed: false,
    retryText: null,
    errorMeta: null,
    review: null,
    usage: null,
    runtime: {
      phase: 'starting',
      status: 'running',
      startedAt,
      updatedAt: startedAt,
      ...(overrides.runtime || {})
    },
    startedAt,
    completedAt: null,
    // 内部状态（reducer 维护，渲染层不应消费）
    _internal: {
      processSeq: 0
    },
    ...overrides
  }
}

/** 用户消息。 */
export function createUserMessage({ content, displayText, attachments = [], timestamp = Date.now() } = {}) {
  return {
    id: null,
    turnId: null,
    role: 'user',
    content: displayText ?? content ?? '',
    attachments: Array.isArray(attachments) ? attachments : [],
    timestamp
  }
}
