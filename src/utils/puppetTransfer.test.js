import { describe, expect, it } from 'vitest'

import {
  buildPuppetTransferBundle,
  decodePuppetTransferPayload,
  encodePuppetTransferPayload,
  getRequiredTransferIds,
  parsePuppetTransferPayload
} from './puppetTransfer.js'

describe('puppet transfer bundle', () => {
  const puppets = [
    { puppetId: 'root-a', parentPuppetId: 'root', puppetName: '根主机', createByUserId: 'u1' },
    { puppetId: 'child-b', parentPuppetId: 'root-a', puppetName: '子主机' },
    { puppetId: 'leaf-c', parentPuppetId: 'child-b', puppetName: '孙主机' }
  ]

  it('preserves ancestry without exporting database identity fields', () => {
    const bundle = buildPuppetTransferBundle(puppets, ['leaf-c'])
    expect(bundle.puppets.map((item) => item.transferId)).toEqual(['root-a', 'child-b', 'leaf-c'])
    expect(bundle.puppets[2].parentTransferId).toBe('child-b')
    expect(bundle.puppets[0].config.puppetId).toBeUndefined()
    expect(bundle.puppets[0].config.createByUserId).toBeUndefined()
  })

  it('round-trips unicode content through base64', () => {
    const bundle = buildPuppetTransferBundle(puppets, ['leaf-c'])
    expect(decodePuppetTransferPayload(encodePuppetTransferPayload(bundle))).toEqual(bundle)
  })

  it('selects all required ancestors for a target', () => {
    const parsed = parsePuppetTransferPayload(buildPuppetTransferBundle(puppets, ['leaf-c']))
    expect([...getRequiredTransferIds(parsed.records, parsed.targetIds)]).toEqual([
      'leaf-c',
      'child-b',
      'root-a'
    ])
  })

  it('includes selected descendants and their intermediate parents only', () => {
    const withSibling = [...puppets, {
      puppetId: 'sibling-d',
      parentPuppetId: 'root-a',
      puppetName: '未选择的兄弟主机'
    }]
    const bundle = buildPuppetTransferBundle(withSibling, ['root-a', 'leaf-c'])
    expect(bundle.puppets.map((item) => item.transferId)).toEqual(['root-a', 'child-b', 'leaf-c'])
    expect(bundle.roots).toEqual(['root-a', 'leaf-c'])
  })
})
