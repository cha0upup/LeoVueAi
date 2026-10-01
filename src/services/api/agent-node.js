import http from '../http.js'
import { createTerminalReadBatcher } from '../terminalReadBatcher.js'

export function initAgentApi(agentId, projectId, hostId) {
  return http.get('/agent-node/init', {
    params: { agentId, ...(projectId ? { projectId } : {}), ...(hostId ? { hostId } : {}) }
  })
}

export function discoverAgentHostsApi(agentId, projectId, force = false) {
  return http.get('/agent-node/discover-hosts', {
    params: { agentId, ...(projectId ? { projectId } : {}), ...(force ? { force: true } : {}) }
  })
}

export function checkAgentCacheApi(agentId) {
  return http.get(`/agent-node/check-cache?agentId=${agentId}`)
}

export function initAgentCacheApi(agentId, projectId, hostId) {
  return http.get('/agent-node/init-cache', {
    params: { agentId, ...(projectId ? { projectId } : {}), ...(hostId ? { hostId } : {}) }
  })
}

export function getAgentCacheHostsApi(agentId, projectId) {
  return http.get('/agent-node/cache-hosts', {
    params: { agentId, ...(projectId ? { projectId } : {}) }
  })
}

export function testAgentConnectionApi(params) {
  return http.post('/agent-node/test-conn', params)
}

export function testAgentConnectionConfigApi(agent) {
  return http.post('/agent-node/test-config', agent)
}

function sendTerminalCommand(params) {
  // Leave transport headroom around command execution and the 10-second long poll.
  let config
  if (['init', 'write', 'write-line'].includes(params.type)) config = { timeout: 45000 }
  else if (params.type === 'read' && Number(params.cmd) > 0) config = { timeout: 30000 }
  return http.post('/agent-node/command/exec-command', params, config)
}

const readTerminalBatch = createTerminalReadBatcher({
  readOne: sendTerminalCommand,
  readBatch: (sessionId, processIds) =>
    http.post('/agent-node/command/read-batch', { sessionId, processIds })
})

export function execCommandApi(params) {
  if (params.type === 'read' && !params.cmd) return readTerminalBatch(params)
  return sendTerminalCommand(params)
}

export function getBasicInfoApi(params) {
  return http.post('/agent-node/basic-info', params)
}

export function getAgentNodeCapabilitiesApi(params) {
  return http.post('/agent-node/capabilities', params)
}
