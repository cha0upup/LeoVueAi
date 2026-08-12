import { computed } from 'vue'

const INITIAL_LEVEL = 0

const normalize = (value) => (value ? String(value).toLowerCase() : '')

const PUPPET_UPDATE_FIELDS = [
  'id',
  'puppetId',
  'parentPuppetId',
  'puppetName',
  'createByUserId',
  'connLink',
  'reqDisguiseId',
  'respDisguiseId',
  'headers',
  'permission',
  'proxyEnabled',
  'maxReqCount',
  'proxyType',
  'proxyHost',
  'proxyPort',
  'protocol',
  'heartbeatInterval',
  'remark'
]

export const buildPuppetUpdatePayload = (row, overrides = {}) => {
  const payload = {}
  PUPPET_UPDATE_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(row, field)) {
      payload[field] = row[field]
    }
  })
  return {
    ...payload,
    ...overrides
  }
}

export const normalizePuppetList = (list = []) => {
  const seen = new Map()
  list.forEach((item) => {
    const key = item?.puppetId
    if (!key) return
    seen.set(key, {
      ...item,
      hasChildren: true,
      level: INITIAL_LEVEL
    })
  })
  return Array.from(seen.values())
}

export const dedupePuppets = (list = []) => {
  const seen = new Set()
  return list.filter((item) => {
    const key = item?.puppetId
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const comparePuppetByName = (a, b) => {
  const left = a?.puppetName || a?.connLink || a?.puppetId || ''
  const right = b?.puppetName || b?.connLink || b?.puppetId || ''
  return String(left).localeCompare(String(right), 'zh-CN', {
    numeric: true,
    sensitivity: 'base'
  })
}

const comparePuppetByUpdateTime = (a, b) => {
  const leftTime = Number(new Date(a?.updateTime || a?.createTime || 0))
  const rightTime = Number(new Date(b?.updateTime || b?.createTime || 0))
  if (leftTime !== rightTime) return rightTime - leftTime
  return comparePuppetByName(a, b)
}

export function usePuppetDirectory({
  allPuppet,
  searchKeyword,
  sortMode,
  prioritizeOnlineNodes,
  connectionTestResults,
  sessionsByPuppetId
}) {
  const getOnlineSortPriority = (row) => {
    if (!prioritizeOnlineNodes.value) return 0
    const puppetId = row?.puppetId
    if (puppetId && sessionsByPuppetId?.value?.[puppetId]?.length) return 0
    const result = puppetId ? connectionTestResults.value[puppetId] : null
    return result?.success ? 0 : 1
  }

  const sortPuppets = (list = []) => {
    const sorted = list.slice()
    const baseSorter = sortMode.value === 'name' ? comparePuppetByName : comparePuppetByUpdateTime
    sorted.sort((a, b) => {
      const onlineDiff = getOnlineSortPriority(a) - getOnlineSortPriority(b)
      if (onlineDiff !== 0) return onlineDiff
      return baseSorter(a, b)
    })
    return sorted
  }

  const filteredPuppets = computed(() => {
    const keyword = normalize(searchKeyword.value).trim()
    const source = dedupePuppets(allPuppet.value)
    if (!keyword) return sortPuppets(source)

    return sortPuppets(
      source.filter((puppet) => {
        const name = normalize(puppet.puppetName)
        const link = normalize(puppet.connLink)
        const parent = normalize(puppet.parentPuppetId)
        const sessions = sessionsByPuppetId?.value?.[puppet.puppetId] || []
        const sessionMatch = sessions.some((session) =>
          normalize(session?.sessionId).includes(keyword)
        )
        return name.includes(keyword) || link.includes(keyword) || parent.includes(keyword) || sessionMatch
      })
    )
  })

  const totalCount = computed(() => allPuppet.value.length)

  return {
    filteredPuppets,
    totalCount,
    sortPuppets
  }
}
