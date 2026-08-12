import { describe, expect, it } from 'vitest'
import { usePuppetImportBatch } from './usePuppetImportBatch.js'

const bundlePuppets = [
  { __transferId: 'root', __parentTransferId: null },
  { __transferId: 'branch', __parentTransferId: 'root' },
  { __transferId: 'leaf', __parentTransferId: 'branch' }
]

describe('usePuppetImportBatch', () => {
  it('selects bundle targets together with their required ancestors', () => {
    const batch = usePuppetImportBatch()
    batch.loadBundle(bundlePuppets, new Set(['leaf']))

    expect([...batch.batchSelectedIndices.value]).toEqual([0, 1, 2])
    expect(batch.batchSelectionSummary.value).toBe('已选 1 台目标，自动包含 2 台依赖')
    expect(batch.selectedBatchPuppets.value).toEqual(bundlePuppets)
  })

  it('recomputes dependencies when targets are toggled', () => {
    const batch = usePuppetImportBatch()
    batch.loadBundle(bundlePuppets, new Set(['branch', 'leaf']))

    batch.toggleBatchItem(2)
    expect([...batch.batchSelectedTargetIds.value]).toEqual(['branch'])
    expect([...batch.batchSelectedIndices.value]).toEqual([0, 1])
    expect(batch.batchIndeterminate.value).toBe(true)

    batch.toggleSelectAll(false)
    expect(batch.batchSelectedIndices.value.size).toBe(0)
    expect(batch.batchAllSelected.value).toBe(false)
  })

  it('resets bundle state', () => {
    const batch = usePuppetImportBatch()
    batch.loadBundle(bundlePuppets, new Set(['leaf']))
    batch.resetBatch()

    expect(batch.batchPuppets.value).toEqual([])
    expect(batch.batchSelectedIndices.value.size).toBe(0)
    expect(batch.batchSelectedTargetIds.value.size).toBe(0)
  })
})
