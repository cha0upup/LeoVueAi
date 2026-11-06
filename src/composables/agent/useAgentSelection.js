import { computed, ref } from 'vue'
import { dedupeAgents } from './useAgentDirectory.js'

/** Keep selection independent of tree rendering, filtering and lazy loading. */
export function useAgentSelection(visibleAgents) {
  const selectedAgents = ref([])
  const selectedAgentIds = computed(() => selectedAgents.value.map((agent) => agent.agentId))
  const selectedIds = computed(() => new Set(selectedAgentIds.value))
  const visibleRows = computed(() => dedupeAgents(visibleAgents.value))
  const visibleSelectedCount = computed(() =>
    visibleRows.value.filter((agent) => selectedIds.value.has(agent.agentId)).length
  )
  const selectedCount = computed(() => selectedAgents.value.length)
  const allVisibleSelected = computed(() =>
    visibleRows.value.length > 0 && visibleSelectedCount.value === visibleRows.value.length
  )
  const someVisibleSelected = computed(() =>
    visibleSelectedCount.value > 0 && !allVisibleSelected.value
  )
  const hiddenSelectedCount = computed(() => selectedCount.value - visibleSelectedCount.value)

  const toggleAgent = (agent, checked) => {
    if (!agent?.agentId) return
    selectedAgents.value = checked
      ? dedupeAgents([...selectedAgents.value, agent])
      : selectedAgents.value.filter((item) => item.agentId !== agent.agentId)
  }

  const toggleVisible = () => {
    if (allVisibleSelected.value) {
      const visibleIds = new Set(visibleRows.value.map((agent) => agent.agentId))
      selectedAgents.value = selectedAgents.value.filter((agent) => !visibleIds.has(agent.agentId))
    } else {
      selectedAgents.value = dedupeAgents([...selectedAgents.value, ...visibleRows.value])
    }
  }

  const clearSelection = () => { selectedAgents.value = [] }

  return {
    selectedAgents,
    selectedAgentIds,
    selectedCount,
    allVisibleSelected,
    someVisibleSelected,
    hiddenSelectedCount,
    toggleAgent,
    toggleVisible,
    clearSelection
  }
}
