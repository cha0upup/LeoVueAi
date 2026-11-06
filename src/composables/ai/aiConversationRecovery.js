import { ACTIVE_AI_STATUSES, normalizeAiStatus } from '@/utils/aiRuntime.js'

/** 两类 AI 共用恢复条件；服务端与本地任一侧有未收口状态都需要同步快照。 */
export function shouldRecoverAiConversation(thread, local = {}) {
  return [thread?.runStatus, local.status].some(value => {
    const status = normalizeAiStatus(value)
    return ACTIVE_AI_STATUSES.includes(status) || status === 'waiting_for_user'
  }) || Boolean(thread?.executing || thread?.pendingUserInput || local.pendingUserInput ||
    local.sending || local.recovering)
}
