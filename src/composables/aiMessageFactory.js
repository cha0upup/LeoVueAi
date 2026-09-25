/**
 * AI 消息工厂：集中创建 assistant / user 消息，保证字段形状一致。
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
