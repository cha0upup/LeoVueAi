const AGENT_TRANSFER_FORMAT = 'leo-agent-bundle'
const AGENT_TRANSFER_VERSION = 2

const EXPORT_OMIT_FIELDS = new Set([
  'agentId',
  'parentAgentId',
  'createByUserId',
  'teamId',
  'hasChildren',
  'level',
  'children',
  'lastConnectedAt',
  'createTime',
  'updateTime'
])

const sanitizeAgentForTransfer = (agent = {}) => {
  return Object.fromEntries(
    Object.entries(agent).filter(([key]) => !EXPORT_OMIT_FIELDS.has(key))
  )
}

const sortRecordsByDependency = (records = []) => {
  const byId = new Map(records.map((record) => [record.transferId, record]))
  const visiting = new Set()
  const visited = new Set()
  const sorted = []

  const visit = (record) => {
    if (visited.has(record.transferId)) return
    if (visiting.has(record.transferId)) throw new Error('主机层级中存在循环依赖')
    visiting.add(record.transferId)
    if (record.parentTransferId) {
      const parent = byId.get(record.parentTransferId)
      if (!parent) throw new Error(`缺少父主机依赖：${record.parentTransferId}`)
      visit(parent)
    }
    visiting.delete(record.transferId)
    visited.add(record.transferId)
    sorted.push(record)
  }

  records.forEach(visit)
  return sorted
}

export const buildAgentTransferBundle = (agents = [], selectedAgentIds = []) => {
  const source = new Map()
  agents.forEach((agent) => {
    if (agent?.agentId) source.set(agent.agentId, agent)
  })
  const roots = [...new Set(selectedAgentIds)].filter((id) => source.has(id))
  const includedIds = new Set()
  roots.forEach((selectedId) => {
    let current = source.get(selectedId)
    const branch = new Set()
    while (current) {
      if (branch.has(current.agentId)) throw new Error('主机层级中存在循环依赖')
      branch.add(current.agentId)
      includedIds.add(current.agentId)
      const parentId = current.parentAgentId
      if (!parentId || parentId === 'root') break
      current = source.get(parentId)
      if (!current) throw new Error(`缺少父主机依赖：${parentId}`)
    }
  })
  const includedAgents = [...source.values()].filter((agent) => includedIds.has(agent.agentId))
  const records = includedAgents.map((agent) => ({
    transferId: agent.agentId,
    parentTransferId:
      agent.parentAgentId && agent.parentAgentId !== 'root' && includedIds.has(agent.parentAgentId)
        ? agent.parentAgentId
        : null,
    config: sanitizeAgentForTransfer(agent)
  }))

  return {
    format: AGENT_TRANSFER_FORMAT,
    version: AGENT_TRANSFER_VERSION,
    exportedAt: new Date().toISOString(),
    roots,
    agents: sortRecordsByDependency(records)
  }
}

export const encodeAgentTransferPayload = (payload) => {
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  const chunkSize = 8192
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

export const decodeAgentTransferPayload = (content) => {
  const binary = atob(String(content || '').trim())
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes))
}

export const parseAgentTransferPayload = (payload) => {
  if (payload?.format !== AGENT_TRANSFER_FORMAT) {
    throw new Error('配置内容不是有效的主机配置包')
  }
  if (payload.version !== AGENT_TRANSFER_VERSION || !Array.isArray(payload.agents)) {
    throw new Error('不支持的主机配置包版本')
  }
  const seen = new Set()
  const records = payload.agents.map((record) => {
    if (!record?.transferId || !record.config || typeof record.config !== 'object') {
      throw new Error('主机配置包结构不完整')
    }
    if (seen.has(record.transferId)) throw new Error('主机配置包包含重复节点')
    seen.add(record.transferId)
    return {
      transferId: String(record.transferId),
      parentTransferId: record.parentTransferId ? String(record.parentTransferId) : null,
      config: record.config
    }
  })
  const sorted = sortRecordsByDependency(records)
  if (!Array.isArray(payload.roots) || !payload.roots.length) {
    throw new Error('主机配置包缺少导入目标')
  }
  const targetIds = new Set(payload.roots.map(String))
  if ([...targetIds].some((id) => !seen.has(id))) {
    throw new Error('主机配置包包含不存在的导入目标')
  }
  return { records: sorted, targetIds }
}

export const getRequiredTransferIds = (records = [], selectedTargetIds = new Set()) => {
  const byId = new Map(records.map((record) => [record.transferId, record]))
  const required = new Set()
  selectedTargetIds.forEach((targetId) => {
    let current = byId.get(targetId)
    const branch = new Set()
    while (current) {
      if (branch.has(current.transferId)) throw new Error('主机层级中存在循环依赖')
      branch.add(current.transferId)
      required.add(current.transferId)
      current = current.parentTransferId ? byId.get(current.parentTransferId) : null
    }
  })
  return required
}
