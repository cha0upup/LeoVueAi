import { describe, expect, it } from 'vitest'
import { Buffer } from 'node:buffer'
import { gzipSync, gunzipSync } from 'node:zlib'
import { createDefaultAgent } from './constants.js'

import {
  buildAgentTransferBundle,
  MAX_AGENT_TRANSFER_BYTES,
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

  it('gzips unicode JSON before base64 encoding and round-trips it', async () => {
    const bundle = buildAgentTransferBundle(agents, ['leaf-c'])
    const encoded = await encodeAgentTransferPayload(bundle)
    const compressed = Buffer.from(encoded, 'base64')
    expect([...compressed.subarray(0, 2)]).toEqual([0x1f, 0x8b])
    expect(JSON.parse(gunzipSync(compressed).toString('utf8'))).toEqual(bundle)
    expect(await decodeAgentTransferPayload(encoded)).toEqual(bundle)
  })

  it('exports configuration without server-owned connection timestamps', async () => {
    const bundle = buildAgentTransferBundle([{
      ...agents[0], lastConnectedAt: '2000-01-01'
    }], ['root-a'])
    const decoded = await decodeAgentTransferPayload(await encodeAgentTransferPayload(bundle))
    const parsed = parseAgentTransferPayload(decoded)
    expect(bundle.version).toBe(2)
    expect(parsed.records[0].config).not.toHaveProperty('lastConnectedAt')
    expect(createDefaultAgent(parsed.records[0].config).agentName).toBe('根主机')
  })

  it('imports gzip content with whitespace and retains existing base64 bundles', async () => {
    const bundle = buildAgentTransferBundle(agents, ['leaf-c'])
    const encoded = gzipSync(JSON.stringify(bundle)).toString('base64')
    expect(await decodeAgentTransferPayload(` \n${encoded.slice(0, 16)}\n${encoded.slice(16)}\t`)).toEqual(bundle)
    expect(await decodeAgentTransferPayload(Buffer.from(JSON.stringify(bundle)).toString('base64'))).toEqual(bundle)
  })

  it.each([
    ['non-JSON content', Buffer.from('not JSON').toString('base64')],
    ['invalid base64', '%%%'],
    ['truncated gzip', gzipSync('{}').subarray(0, 10).toString('base64')]
  ])('rejects %s', async (_name, encoded) => {
    await expect(decodeAgentTransferPayload(encoded)).rejects.toThrow()
  })

  it('bounds both exported JSON and decompressed import size', async () => {
    const oversized = { data: 'x'.repeat(MAX_AGENT_TRANSFER_BYTES) }
    await expect(encodeAgentTransferPayload(oversized)).rejects.toThrow('10 MB')
    const encoded = gzipSync(JSON.stringify(oversized)).toString('base64')
    await expect(decodeAgentTransferPayload(encoded)).rejects.toThrow('10 MB')
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
