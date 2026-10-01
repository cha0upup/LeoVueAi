import { describe, expect, it } from 'vitest'

import {
  buildAgentTransferBundle,
  decodeAgentTransferPayload,
  encodeAgentTransferPayload,
  getRequiredTransferIds,
  parseAgentTransferPayload
} from './agentTransfer.js'

describe('agent transfer bundle', () => {
  const agents = [
    { agentId: 'root-a', parentAgentId: 'root', agentName: '根主机', createByUserId: 'u1' },
    { agentId: 'child-b', parentAgentId: 'root-a', agentName: '子主机' },
    { agentId: 'leaf-c', parentAgentId: 'child-b', agentName: '孙主机' }
  ]

  it('preserves ancestry without exporting database identity fields', () => {
    const bundle = buildAgentTransferBundle(agents, ['leaf-c'])
    expect(bundle.agents.map((item) => item.transferId)).toEqual(['root-a', 'child-b', 'leaf-c'])
    expect(bundle.agents[2].parentTransferId).toBe('child-b')
    expect(bundle.agents[0].config.agentId).toBeUndefined()
    expect(bundle.agents[0].config.createByUserId).toBeUndefined()
  })

  it('round-trips unicode content through base64', () => {
    const bundle = buildAgentTransferBundle(agents, ['leaf-c'])
    expect(decodeAgentTransferPayload(encodeAgentTransferPayload(bundle))).toEqual(bundle)
  })

  it('selects all required ancestors for a target', () => {
    const parsed = parseAgentTransferPayload(buildAgentTransferBundle(agents, ['leaf-c']))
    expect([...getRequiredTransferIds(parsed.records, parsed.targetIds)]).toEqual([
      'leaf-c',
      'child-b',
      'root-a'
    ])
  })

  it('rejects bundles without the current format target list', () => {
    const bundle = buildAgentTransferBundle(agents, ['leaf-c'])
    delete bundle.roots
    expect(() => parseAgentTransferPayload(bundle)).toThrow('主机配置包缺少导入目标')

    bundle.roots = ['missing-id']
    expect(() => parseAgentTransferPayload(bundle)).toThrow('主机配置包包含不存在的导入目标')
  })

  it('includes selected descendants and their intermediate parents only', () => {
    const withSibling = [...agents, {
      agentId: 'sibling-d',
      parentAgentId: 'root-a',
      agentName: '未选择的兄弟主机'
    }]
    const bundle = buildAgentTransferBundle(withSibling, ['root-a', 'leaf-c'])
    expect(bundle.agents.map((item) => item.transferId)).toEqual(['root-a', 'child-b', 'leaf-c'])
    expect(bundle.roots).toEqual(['root-a', 'leaf-c'])
  })
})
