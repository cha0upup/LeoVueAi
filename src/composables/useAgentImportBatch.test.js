import { describe, expect, it } from 'vitest'
import { useAgentImportBatch } from './useAgentImportBatch.js'

const bundleAgents = [
  { __transferId: 'root', __parentTransferId: null },
  { __transferId: 'branch', __parentTransferId: 'root' },
  { __transferId: 'leaf', __parentTransferId: 'branch' }
]

describe('useAgentImportBatch', () => {
  it('selects bundle targets together with their required ancestors', () => {
    const batch = useAgentImportBatch()
    batch.loadBundle(bundleAgents, new Set(['leaf']))

    expect([...batch.batchSelectedIndices.value]).toEqual([0, 1, 2])
    expect(batch.batchSelectionSummary.value).toBe('已选 1 台目标，自动包含 2 台依赖')
    expect(batch.selectedBatchAgents.value).toEqual(bundleAgents)
  })

  it('recomputes dependencies when targets are toggled', () => {
    const batch = useAgentImportBatch()
    batch.loadBundle(bundleAgents, new Set(['branch', 'leaf']))

    batch.toggleBatchItem(2)
    expect(batch.isBatchItemChecked(bundleAgents[1], 1)).toBe(true)
    expect(batch.isBatchItemChecked(bundleAgents[2], 2)).toBe(false)
    expect([...batch.batchSelectedIndices.value]).toEqual([0, 1])
    expect(batch.batchIndeterminate.value).toBe(true)

    batch.toggleSelectAll(false)
    expect(batch.batchSelectedIndices.value.size).toBe(0)
    expect(batch.batchAllSelected.value).toBe(false)
  })

  it('resets bundle state', () => {
    const batch = useAgentImportBatch()
    batch.loadBundle(bundleAgents, new Set(['leaf']))
    batch.resetBatch()

    expect(batch.batchAgents.value).toEqual([])
    expect(batch.batchSelectedIndices.value.size).toBe(0)
    expect(batch.selectedBatchAgents.value).toEqual([])
    expect(batch.batchSelectionSummary.value).toBe('已选 0 台目标，自动包含 0 台依赖')
    expect(batch.batchIndeterminate.value).toBe(false)
    expect(batch.batchAllSelected.value).toBe(false)
  })

  it('keeps required ancestors selected when they are not explicit targets', () => {
    const batch = useAgentImportBatch()
    batch.loadBundle(bundleAgents, new Set(['leaf']))
    expect(batch).not.toHaveProperty('batchSelectedTargetIds')
    batch.toggleBatchItem(0)
    expect(batch.isSelectableTargetItem(bundleAgents[0])).toBe(false)
    expect(batch.isDependencyItem(bundleAgents[0])).toBe(true)
    expect(batch.isBatchItemChecked(bundleAgents[0], 0)).toBe(true)
    expect(batch.selectedBatchAgents.value).toEqual(bundleAgents)
  })

  it('replaces the previous target selection when a new bundle is loaded', () => {
    const batch = useAgentImportBatch()
    batch.loadBundle(bundleAgents, new Set(['leaf']))
    batch.toggleSelectAll(false)
    batch.loadBundle(bundleAgents, new Set(['branch']))
    expect(batch.selectedBatchAgents.value).toEqual(bundleAgents.slice(0, 2))
    expect(batch.batchAllSelected.value).toBe(true)
    expect(batch.batchIndeterminate.value).toBe(false)
    expect(batch.batchSubmitLabel.value).toBe('导入 1 台目标及 1 台依赖')
  })
})
