import { computed } from 'vue'

const INITIAL_LEVEL = 0

const normalize = (value) => (value ? String(value).toLowerCase() : '')

// 更新接口会全量覆盖配置，快捷开关也必须保留所有持久化字段。
const AGENT_UPDATE_FIELDS = [
  'agentId',
  'parentAgentId',
  'agentName',
  'createByUserId',
  'teamId',
  'connLink',
  'reqDisguiseId',
  'respDisguiseId',
  'payloadKey',
  'headers',
  'permission',
  'proxyEnabled',
  'maxReqCount',
  'proxyType',
  'proxyHost',
  'proxyPort',
  'protocol',
  'type',
  'lastHeartbeat',
  'heartbeatInterval',
  'remark',
  'urlStrategy',
  'paddingStrategy',
  'headerNoiseStrategy',
  'tlsFingerprintStrategy',
  'componentClassNameStrategy'
]

export const buildAgentUpdatePayload = (row, overrides = {}) => {
  const payload = {}
  AGENT_UPDATE_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(row, field)) {
      payload[field] = row[field]
    }
  })
  return {
    ...payload,
    ...overrides
  }
}

export const normalizeAgentList = (list = []) => {
  const seen = new Map()
  list.forEach((item) => {
    const key = item?.agentId
    if (!key) return
    seen.set(key, {
      ...item,
      hasChildren: true,
      level: INITIAL_LEVEL
    })
  })
  return Array.from(seen.values())
}

export const dedupeAgents = (list = []) => {
  const seen = new Set()
  return list.filter((item) => {
    const key = item?.agentId
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const compareAgentByName = (a, b) => {
  const left = a?.agentName || a?.connLink || a?.agentId || ''
  const right = b?.agentName || b?.connLink || b?.agentId || ''
  return String(left).localeCompare(String(right), 'zh-CN', {
    numeric: true,
    sensitivity: 'base'
  })
}

const compareAgentByUpdateTime = (a, b) => {
  const leftTime = Number(new Date(a?.updateTime || a?.createTime || 0))
  const rightTime = Number(new Date(b?.updateTime || b?.createTime || 0))
  if (leftTime !== rightTime) return rightTime - leftTime
  return compareAgentByName(a, b)
}

export function useAgentDirectory({
  allAgents,
  searchKeyword,
  sortMode,
  prioritizeOnlineNodes,
  connectionTestResults,
  sessionsByAgentId
}) {
  const getOnlineSortPriority = (row) => {
    if (!prioritizeOnlineNodes.value) return 0
    const agentId = row?.agentId
    if (agentId && sessionsByAgentId?.value?.[agentId]?.length) return 0
    const result = agentId ? connectionTestResults.value[agentId] : null
    return result?.success ? 0 : 1
  }

  const sortAgents = (list = []) => {
    const sorted = list.slice()
    const baseSorter = sortMode.value === 'name' ? compareAgentByName : compareAgentByUpdateTime
    sorted.sort((a, b) => {
      const onlineDiff = getOnlineSortPriority(a) - getOnlineSortPriority(b)
      if (onlineDiff !== 0) return onlineDiff
      return baseSorter(a, b)
    })
    return sorted
  }

  const filteredAgents = computed(() => {
    const keyword = normalize(searchKeyword.value).trim()
    const source = dedupeAgents(allAgents.value)
    if (!keyword) return sortAgents(source)

    return sortAgents(
      source.filter((agent) => {
        const name = normalize(agent.agentName)
        const link = normalize(agent.connLink)
        const parent = normalize(agent.parentAgentId)
        const sessions = sessionsByAgentId?.value?.[agent.agentId] || []
        const sessionMatch = sessions.some((session) =>
          normalize(session?.sessionId).includes(keyword)
        )
        return name.includes(keyword) || link.includes(keyword) || parent.includes(keyword) || sessionMatch
      })
    )
  })

  const totalCount = computed(() => allAgents.value.length)

  return {
    filteredAgents,
    totalCount,
    sortAgents
  }
}
