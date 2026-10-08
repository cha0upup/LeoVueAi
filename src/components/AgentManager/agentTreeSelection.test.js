import { describe, expect, it } from 'vitest'
import { collectVisibleAgents } from './agentTreeSelection.js'

describe('visible tree selection scope', () => {
  const child = { data: { agentId: 'child' }, visible: true, expanded: false }
  const parent = { data: { agentId: 'parent' }, visible: true, expanded: true, childNodes: [child] }

  it('includes expanded loaded children but excludes collapsed descendants', () => {
    expect(collectVisibleAgents([parent.data], () => parent).map(row => row.agentId))
      .toEqual(['parent', 'child'])
    expect(collectVisibleAgents([parent.data], () => ({ ...parent, expanded: false })))
      .toEqual([parent.data])
  })

  it('excludes filtered nodes and their entire subtree', () => {
    expect(collectVisibleAgents([parent.data], () => ({ ...parent, visible: false }))).toEqual([])
    const node = { ...parent, childNodes: [{ ...child, visible: false }] }
    expect(collectVisibleAgents([parent.data], () => node)).toEqual([parent.data])
  })

  it('handles duplicate IDs and cycles without selecting anything twice', () => {
    const node = { ...parent, childNodes: [] }
    node.childNodes.push(node)
    expect(collectVisibleAgents([parent.data, parent.data, {}], () => node)).toEqual([parent.data])
  })

  it('reports root rows while the lazy tree is being mounted', () => {
    expect(collectVisibleAgents([parent.data], () => null)).toEqual([parent.data])
  })
})
