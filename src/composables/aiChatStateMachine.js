/**
 * AI 会话状态机：集中管理 state.status 的转换规则与转换执行。
 *
 * 设计目标：
 * - 所有 status 变更走 transitionStatus() 单点
 * - 非法转换打 warn，便于开发期立刻发现
 * - 自动记录最近 N 次转换，便于排查
 */

import { normalizeAiStatus } from '@/utils/aiRuntime.js'

/**
 * 转换表：from → 允许的 next 集合。
 * 终态可重新进入 running（新一轮 send）。
 */
const TRANSITIONS = {
  idle: ['queued', 'running', 'cancelling', 'waiting_for_user'],
  queued: ['running', 'cancelling', 'failed', 'cancelled'],
  running: ['cancelling', 'completed', 'failed', 'cancelled', 'running', 'waiting_for_user'],
  cancelling: ['completed', 'failed', 'cancelled'],
  completed: ['queued', 'running', 'idle'],
  failed: ['queued', 'running', 'idle'],
  cancelled: ['queued', 'running', 'idle'],
  waiting_for_user: ['queued', 'running', 'cancelled', 'idle', 'waiting_for_user']
}

const TRANSITION_HISTORY_MAX = 20

/** 是否合法转换。 */
function canTransition(from, to) {
  const fromN = normalizeAiStatus(from, 'idle')
  const toN = normalizeAiStatus(to, 'idle')
  if (fromN === toN) return true
  const allowed = TRANSITIONS[fromN]
  return Array.isArray(allowed) && allowed.includes(toN)
}

/**
 * 执行转换。返回最终生效的 status。
 *
 * 非法转换在开发期 console.warn，但仍允许写入（避免阻塞业务）。
 *
 * @param {object} state - { status, _statusHistory? }
 * @param {string} next  - 目标状态
 * @param {string} [reason] - 触发原因（写入历史）
 */
export function transitionStatus(state, next, reason = '') {
  if (!state) return next
  const from = state.status || 'idle'
  const target = normalizeAiStatus(next, from)

  if (target === from) return from

  if (!canTransition(from, target)) {
    // 开发期警告，生产期静默通过
    // eslint-disable-next-line no-console
    console.warn(`[ai-state] invalid transition ${from} → ${target}${reason ? ` (${reason})` : ''}`)
  }

  if (!Array.isArray(state._statusHistory)) state._statusHistory = []
  state._statusHistory.push({ from, to: target, reason, at: Date.now() })
  if (state._statusHistory.length > TRANSITION_HISTORY_MAX) {
    state._statusHistory.splice(0, state._statusHistory.length - TRANSITION_HISTORY_MAX)
  }
  state.status = target
  return target
}
