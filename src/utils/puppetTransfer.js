const PUPPET_TRANSFER_FORMAT = 'leo-puppet-bundle'
const PUPPET_TRANSFER_VERSION = 2

const EXPORT_OMIT_FIELDS = new Set([
  'puppetId',
  'parentPuppetId',
  'createByUserId',
  'teamId',
  'hasChildren',
  'level',
  'children',
  'lastHeartbeat',
  'createTime',
  'updateTime'
])

const sanitizePuppetForTransfer = (puppet = {}) => {
  return Object.fromEntries(
    Object.entries(puppet).filter(([key]) => !EXPORT_OMIT_FIELDS.has(key))
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

export const buildPuppetTransferBundle = (puppets = [], selectedPuppetIds = []) => {
  const source = new Map()
  puppets.forEach((puppet) => {
    if (puppet?.puppetId) source.set(puppet.puppetId, puppet)
  })
  const roots = [...new Set(selectedPuppetIds)].filter((id) => source.has(id))
  const includedIds = new Set()
  roots.forEach((selectedId) => {
    let current = source.get(selectedId)
    const branch = new Set()
    while (current) {
      if (branch.has(current.puppetId)) throw new Error('主机层级中存在循环依赖')
      branch.add(current.puppetId)
      includedIds.add(current.puppetId)
      const parentId = current.parentPuppetId
      if (!parentId || parentId === 'root') break
      current = source.get(parentId)
      if (!current) throw new Error(`缺少父主机依赖：${parentId}`)
    }
  })
  const includedPuppets = [...source.values()].filter((puppet) => includedIds.has(puppet.puppetId))
  const records = includedPuppets.map((puppet) => ({
    transferId: puppet.puppetId,
    parentTransferId:
      puppet.parentPuppetId && puppet.parentPuppetId !== 'root' && includedIds.has(puppet.parentPuppetId)
        ? puppet.parentPuppetId
        : null,
    config: sanitizePuppetForTransfer(puppet)
  }))

  return {
    format: PUPPET_TRANSFER_FORMAT,
    version: PUPPET_TRANSFER_VERSION,
    exportedAt: new Date().toISOString(),
    roots,
    puppets: sortRecordsByDependency(records)
  }
}

export const encodePuppetTransferPayload = (payload) => {
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  const chunkSize = 8192
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

export const decodePuppetTransferPayload = (content) => {
  const binary = atob(String(content || '').trim())
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes))
}

export const parsePuppetTransferPayload = (payload) => {
  if (payload?.format !== PUPPET_TRANSFER_FORMAT) {
    throw new Error('配置内容不是有效的主机配置包')
  }
  if (payload.version !== PUPPET_TRANSFER_VERSION || !Array.isArray(payload.puppets)) {
    throw new Error('不支持的主机配置包版本')
  }
  const seen = new Set()
  const records = payload.puppets.map((record) => {
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
  const targetIds = new Set((payload.roots || []).map(String).filter((id) => seen.has(id)))
  if (!targetIds.size) sorted.forEach((record) => targetIds.add(record.transferId))
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
