import { ref } from 'vue'
import { describe, expect, it } from 'vitest'

import { buildAgentUpdatePayload, useAgentDirectory } from './useAgentDirectory.js'

describe('proxy quick-toggle update payload', () => {
  it.each([
    ['java', 0, 1],
    ['java', 1, 0],
    ['php', 0, 1],
    ['php', 1, 0]
  ])('preserves the %s host configuration when switching proxy from %i to %i', (type, current, next) => {
    const host = {
      agentId: 'host-with-config',
      agentName: 'Configured host',
      parentAgentId: 'root',
      createByUserId: 'owner-1',
      teamId: 'team-1',
      connLink: 'http://localhost:8080/host',
      protocol: 'http',
      type,
      headers: '{"User-Agent":"custom-client"}',
      reqDisguiseId: 'request-disguise',
      respDisguiseId: 'response-disguise',
      payloadKey: type === 'java' ? '0123456789abcdef' : '',
      proxyEnabled: current,
      proxyType: 'http',
      proxyHost: '127.0.0.1',
      proxyPort: 8080,
      maxReqCount: 3,
      permission: 'team',
      lastHeartbeat: '2026-09-20 12:00:00',
      heartbeatInterval: 30000,
      remark: 'Keep existing settings',
      urlStrategy: '{"enabled":true,"pool":["/host"]}',
      paddingStrategy: '{"enabled":true,"minBytes":32,"maxBytes":64}',
      headerNoiseStrategy: '{"enabled":true,"minHeaders":1,"maxHeaders":2}',
      tlsFingerprintStrategy: '{"enabled":true,"profile":"chrome"}',
      componentClassNameStrategy: '{"enabled":true,"packagePrefix":"com.example"}'
    }

    const payload = buildAgentUpdatePayload({
      id: 'client-only-row-id',
      ...host,
      hasChildren: true,
      level: 0,
      children: [],
      createTime: '2026-09-01 12:00:00',
      updateTime: '2026-09-19 12:00:00'
    }, { proxyEnabled: next })

    expect(payload).toEqual({ ...host, proxyEnabled: next })
    expect(payload).not.toHaveProperty('id')
    expect(host.proxyEnabled).toBe(current)
  })
})

const createDirectory = ({ keyword = '', prioritizeOnline = false } = {}) => {
  const allAgents = ref([
    {
      agentId: 'host-a',
      agentName: 'alpha',
      connLink: 'http://alpha.test',
      updateTime: '2026-07-01T00:00:00Z'
    },
    {
      agentId: 'host-b',
      agentName: 'beta',
      connLink: 'http://beta.test',
      updateTime: '2026-07-12T00:00:00Z'
    }
  ])
  const searchKeyword = ref(keyword)
  const sortMode = ref('updateTime')
  const prioritizeOnlineNodes = ref(prioritizeOnline)
  const connectionTestResults = ref({})
  const sessionsByAgentId = ref({
    'host-a': [{ sessionId: 'live-session-123' }]
  })

  return useAgentDirectory({
    allAgents,
    searchKeyword,
    sortMode,
    prioritizeOnlineNodes,
    connectionTestResults,
    sessionsByAgentId
  })
}

describe('useAgentDirectory live-session integration', () => {
  it('finds a host by a mounted session id', () => {
    const { filteredAgents } = createDirectory({ keyword: 'session-123' })

    expect(filteredAgents.value.map((item) => item.agentId)).toEqual(['host-a'])
  })

  it('prioritizes hosts with live sessions when online sorting is enabled', () => {
    const { filteredAgents } = createDirectory({ prioritizeOnline: true })

    expect(filteredAgents.value.map((item) => item.agentId)).toEqual(['host-a', 'host-b'])
  })
})
