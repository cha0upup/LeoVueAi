import http from '../http.js'
import { createTerminalReadBatcher } from '../terminalReadBatcher.js'

export function initPuppetApi(puppetId, projectId, hostId) {
  return http.get('/puppet-node/init', {
    params: { puppetId, ...(projectId ? { projectId } : {}), ...(hostId ? { hostId } : {}) }
  })
}

export function discoverPuppetHostsApi(puppetId, projectId, force = false) {
  return http.get('/puppet-node/discover-hosts', {
    params: { puppetId, ...(projectId ? { projectId } : {}), ...(force ? { force: true } : {}) }
  })
}

export function checkPuppetCacheApi(puppetId) {
  return http.get(`/puppet-node/check-cache?puppetId=${puppetId}`)
}

export function initPuppetCacheApi(puppetId, projectId, hostId) {
  return http.get('/puppet-node/init-cache', {
    params: { puppetId, ...(projectId ? { projectId } : {}), ...(hostId ? { hostId } : {}) }
  })
}

export function getPuppetCacheHostsApi(puppetId, projectId) {
  return http.get('/puppet-node/cache-hosts', {
    params: { puppetId, ...(projectId ? { projectId } : {}) }
  })
}

export function testPuppetConnApi(params) {
  return http.post('/puppet-node/test-conn', params)
}

export function testPuppetConfigApi(puppet) {
  return http.post('/puppet-node/test-config', puppet)
}

function sendTerminalCommand(params) {
  // Leave transport headroom around command execution and the 10-second long poll.
  let config
  if (['init', 'write', 'write-line'].includes(params.type)) config = { timeout: 45000 }
  else if (params.type === 'read' && Number(params.cmd) > 0) config = { timeout: 30000 }
  return http.post('/puppet-node/command/exec-command', params, config)
}

const readTerminalBatch = createTerminalReadBatcher({
  readOne: sendTerminalCommand,
  readBatch: (sessionId, processIds) =>
    http.post('/puppet-node/command/read-batch', { sessionId, processIds })
})

export function execCommandApi(params) {
  const { batchRead, ...command } = params
  if (batchRead === true && command.type === 'read' && !command.cmd)
    return readTerminalBatch(command)
  return sendTerminalCommand(command)
}

export function getBasicInfoApi(params) {
  return http.post('/puppet-node/basic-info', params)
}

export function getPuppetNodeCapabilitiesApi(params) {
  return http.post('/puppet-node/capabilities', params)
}
