import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useAgentSelection } from './useAgentSelection.js'

const agent = (agentId, parentAgentId = 'root') => ({ agentId, parentAgentId })

describe('useAgentSelection', () => {
  it('selects and clears the visible list without entering a separate mode', () => {
    const selection = useAgentSelection(ref([agent('a'), agent('b')]))
    selection.toggleAgent(agent('a'), true)
    expect(selection.someVisibleSelected.value).toBe(true)
    selection.toggleVisible()
    expect(selection.selectedAgentIds.value).toEqual(['a', 'b'])
    expect(selection.allVisibleSelected.value).toBe(true)
    selection.toggleVisible()
    expect(selection.selectedCount.value).toBe(0)
  })

  it('uses ID membership, not equal counts, to determine whether all rows are selected', () => {
    const selection = useAgentSelection(ref([agent('a'), agent('b')]))
    selection.toggleAgent(agent('a'), true)
    selection.toggleAgent(agent('hidden'), true)
    expect(selection.selectedCount.value).toBe(2)
    expect(selection.allVisibleSelected.value).toBe(false)
    expect(selection.someVisibleSelected.value).toBe(true)
    expect(selection.hiddenSelectedCount.value).toBe(1)
  })

  it('retains hidden selections when filtering and only toggles visible rows', () => {
    const visible = ref([agent('a'), agent('b')])
    const selection = useAgentSelection(visible)
    selection.toggleVisible()
    visible.value = [agent('b')]
    expect(selection.selectedCount.value).toBe(2)
    expect(selection.hiddenSelectedCount.value).toBe(1)
    selection.toggleVisible()
    expect(selection.selectedAgentIds.value).toEqual(['a'])
    visible.value = [agent('b'), agent('a')]
    expect(selection.hiddenSelectedCount.value).toBe(0)
    expect(selection.someVisibleSelected.value).toBe(true)
  })

  it('keeps parent and child checks independent, including after collapsing children', () => {
    const visible = ref([agent('parent'), agent('child', 'parent')])
    const selection = useAgentSelection(visible)
    selection.toggleAgent(agent('parent'), true)
    expect(selection.selectedAgentIds.value).toEqual(['parent'])
    selection.toggleVisible()
    visible.value = [agent('parent')]
    selection.toggleVisible()
    expect(selection.selectedAgentIds.value).toEqual(['child'])
    expect(selection.hiddenSelectedCount.value).toBe(1)
    selection.clearSelection()
    expect(selection.selectedCount.value).toBe(0)
  })

  it('ignores invalid IDs and deduplicates repeated tree notifications', () => {
    const selection = useAgentSelection(ref([agent('a'), agent('a'), {}]))
    selection.toggleAgent({}, true)
    selection.toggleAgent(agent('a'), true)
    selection.toggleAgent(agent('a'), true)
    expect(selection.selectedCount.value).toBe(1)
    expect(selection.allVisibleSelected.value).toBe(true)
    selection.toggleAgent(agent('a'), false)
    expect(selection.selectedCount.value).toBe(0)
  })

  it('handles an empty search result without discarding the batch', () => {
    const visible = ref([agent('a')])
    const selection = useAgentSelection(visible)
    selection.toggleVisible()
    visible.value = []
    selection.toggleVisible()
    expect(selection.selectedCount.value).toBe(1)
    expect(selection.allVisibleSelected.value).toBe(false)
    expect(selection.someVisibleSelected.value).toBe(false)
    expect(selection.hiddenSelectedCount.value).toBe(1)
  })
})
