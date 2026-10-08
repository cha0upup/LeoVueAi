/** Include only rendered rows; selecting a parent never implicitly selects children. */
export function collectVisibleAgents(agents, getNode) {
  const rows = []
  const visited = new Set()
  const visit = (data, node = getNode(data?.agentId)) => {
    if (!data?.agentId || visited.has(data.agentId) || node?.visible === false) return
    visited.add(data.agentId)
    rows.push(data)
    if (node?.expanded) {
      for (const child of node.childNodes || []) visit(child.data, child)
    }
  }
  for (const agent of agents) visit(agent)
  return rows
}
