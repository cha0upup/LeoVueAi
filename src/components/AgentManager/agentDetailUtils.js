import { ElMessage } from 'element-plus'
import { icons } from '@/utils/icons.js'

/** Shared connection and cache status; identity and session props stay with each component. */
export const agentDetailStatusProps = {
  connectionTestLoading: { type: Boolean, default: false },
  isCurrentAgentTesting: { type: Boolean, default: false },
  batchTestLoading: { type: Boolean, default: false },
  testConnResult: { type: Object, default: null },
  cacheCheckResult: { type: Object, default: null },
  cacheCheckLoading: { type: Boolean, default: false },
  cacheAvailability: { type: Object, default: () => ({ checked: false, hasCache: false, saveTime: null }) },
  cacheAvailabilityLoading: { type: Boolean, default: false }
}

export const isChildHost = (row) => row?.parentAgentId && row.parentAgentId !== 'root'

export const getHostIcon = (row) => (isChildHost(row) ? icons.connection : icons.server)

export const isAgentQuickSaving = (agent, quickSavingKey, field) =>
  Boolean(agent?.agentId && quickSavingKey === `${agent.agentId}:${field}`)

export const getHostDisplayName = (agent) => {
  const name = String(agent?.agentName || '').trim()
  const link = String(agent?.connLink || '').trim()
  if (name && name !== link) return name
  try {
    return new URL(link).host || name || '未命名主机'
  } catch {
    return name || link || '未命名主机'
  }
}

export const copyHostDetail = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制')
  } catch {
    ElMessage.warning('复制失败，请选择文本手动复制')
  }
}
