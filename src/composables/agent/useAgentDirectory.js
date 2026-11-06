import { computed } from 'vue'

const INITIAL_LEVEL = 0

const normalize = (value) => (value ? String(value).toLowerCase() : '')

// 快捷开关保留可编辑配置；服务端连接时间不参与更新。
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
  'remark',
  'urlStrategy',
  'paddingStrategy',
  'headerNoiseStrategy',
  'tlsFingerprintStrategy',
  'componentClassNameStrategy'
]

export const buildAgentUpdatePayload = (row, overrides = {}) => {
  const source = { ...row, ...overrides }
  const payload = {}
  AGENT_UPDATE_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      payload[field] = source[field]
    }
  })
  return payload
}

export const normalizeAgentList = (list = [], level = INITIAL_LEVEL) => {
  const seen = new Map()
  list.forEach((item) => {
    const key = item?.agentId
    if (!key) return
    seen.set(key, {
      ...item,
      hasChildren: typeof item.hasChildren === 'boolean'
        ? item.hasChildren
        : Array.isArray(item.children) && item.children.length > 0,
      level
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
  sessionsByAgentId
}) {
  const sortAgents = (list = []) => {
    const compare = sortMode.value === 'name' ? compareAgentByName : compareAgentByUpdateTime
    return list.slice().sort(compare)
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
