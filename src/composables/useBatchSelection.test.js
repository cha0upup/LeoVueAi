import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useBatchSelection } from './useBatchSelection.js'

describe('useBatchSelection', () => {
  it('tracks visible, partial, hidden and cleared selections by stable id', () => {
    const items = ref([
      { id: 'a' },
      { id: 'b' },
      { id: 'c' }
    ])
    const selection = useBatchSelection(items, item => item.id)

    expect(selection.allFilteredSelected.value).toBe(false)
    expect(selection.someFilteredSelected.value).toBe(false)

    selection.setSelected(items.value[0], true)
    expect(selection.someFilteredSelected.value).toBe(true)
    expect(selection.selectedIds.value.has('a')).toBe(true)

    items.value = items.value.filter(item => item.id !== 'a')
    expect(selection.allFilteredSelected.value).toBe(false)
    expect(selection.someFilteredSelected.value).toBe(false)
    expect(selection.selectedIds.value.has('a')).toBe(true)

    selection.toggleSelectAll(true)
    expect([...selection.selectedIds.value]).toEqual(['a', 'b', 'c'])
    expect(selection.allFilteredSelected.value).toBe(true)
    expect(selection.someFilteredSelected.value).toBe(false)

    selection.toggleSelectAll(false)
    expect([...selection.selectedIds.value]).toEqual(['a'])
    expect(selection.allFilteredSelected.value).toBe(false)
    expect(selection.someFilteredSelected.value).toBe(false)

    selection.clearBatchSelection()
    expect(selection.selectedIds.value.size).toBe(0)
    expect(selection.allFilteredSelected.value).toBe(false)
  })

  it('keeps selections across empty filters and list refreshes with new objects', () => {
    const items = ref([{ id: 'a' }])
    const selection = useBatchSelection(items, item => item.id)
    selection.toggleSelectAll(true)

    items.value = []
    selection.toggleSelectAll(false)
    expect(selection.allFilteredSelected.value).toBe(false)
    expect(selection.someFilteredSelected.value).toBe(false)
    expect([...selection.selectedIds.value]).toEqual(['a'])

    items.value = [{ id: 'a', name: 'updated' }]
    expect(selection.allFilteredSelected.value).toBe(true)
    selection.setSelected(items.value[0], false)
    expect(selection.selectedIds.value.size).toBe(0)
  })

  it('ignores items without an id', () => {
    const items = ref([{ id: '' }, { id: 'ok' }])
    const selection = useBatchSelection(items, item => item.id)

    selection.toggleSelectAll(true)

    expect([...selection.selectedIds.value]).toEqual(['ok'])
  })
})
