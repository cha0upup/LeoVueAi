import { ref } from 'vue'
import { describe, expect, it } from 'vitest'

import { buildAgentUpdatePayload, normalizeAgentList, useAgentDirectory } from './useAgentDirectory.js'

describe('directory child metadata', () => {
  it('preserves real branches and leaves instead of marking every host expandable', () => {
    const rows = normalizeAgentList([
      { agentId: 'branch', hasChildren: true },
      { agentId: 'leaf', hasChildren: false },
      { agentId: 'empty' }
    ])
    expect(rows.map(row => row.hasChildren)).toEqual([true, false, false])
    expect(rows.every(row => row.level === 0)).toBe(true)
  })

  it('uses the same metadata normalization for lazy-loaded child rows', () => {
    const input = [{ agentId: 'child', hasChildren: false }]
    expect(normalizeAgentList(input, 2)).toEqual([{ agentId: 'child', hasChildren: false, level: 2 }])
    expect(input[0]).not.toHaveProperty('level')
  })

  it('recognizes already loaded children and retains deduplication', () => {
    expect(normalizeAgentList([
      { agentId: 'parent', children: [{ agentId: 'child' }] },
      { agentId: 'leaf', hasChildren: true },
      { agentId: 'leaf', hasChildren: false },
      null
    ]).map(row => [row.agentId, row.hasChildren])).toEqual([['parent', true], ['leaf', false]])
  })

  it('uses the server flag rather than stale loaded children or a truthy string', () => {
    expect(normalizeAgentList([
      { agentId: 'stale', hasChildren: false, children: [{ agentId: 'removed-child' }] },
      { agentId: 'invalid', hasChildren: 'false' }
    ]).map(row => row.hasChildren)).toEqual([false, false])
  })
})

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
      lastConnectedAt: '2026-09-20 12:00:00',
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

    const editable = { ...host, proxyEnabled: next }
    delete editable.lastConnectedAt
    expect(payload).toEqual(editable)
    expect(payload).not.toHaveProperty('lastConnectedAt')
    expect(payload).not.toHaveProperty('id')
    expect(host.proxyEnabled).toBe(current)
  })

  it('filters server-owned fields from explicit overrides too', () => {
    const payload = buildAgentUpdatePayload({ agentId: 'node', lastConnectedAt: '2026-01-01' }, {
      remark: 'edited', createTime: '2000-01-01', lastConnectedAt: '2000-01-01'
    })
    expect(payload).toEqual({ agentId: 'node', remark: 'edited' })
  })
})

const createDirectory = ({ keyword = '' } = {}) => {
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
  const sessionsByAgentId = ref({
    'host-a': [{ sessionId: 'live-session-123' }]
  })

  const directory = useAgentDirectory({
    allAgents,
    searchKeyword,
    sortMode,
    sessionsByAgentId
  })
  return { ...directory, allAgents, sortMode, sessionsByAgentId }
}

describe('useAgentDirectory live-session integration', () => {
  it('finds a host by a mounted session id', () => {
    const { filteredAgents } = createDirectory({ keyword: 'session-123' })

    expect(filteredAgents.value.map((item) => item.agentId)).toEqual(['host-a'])
  })

  it('keeps explicit update-time ordering when live sessions change', () => {
    const { filteredAgents, sessionsByAgentId } = createDirectory()
    expect(filteredAgents.value.map(item => item.agentId)).toEqual(['host-b', 'host-a'])
    sessionsByAgentId.value = { 'host-b': [{ sessionId: 'new-session' }] }
    expect(filteredAgents.value.map(item => item.agentId)).toEqual(['host-b', 'host-a'])
  })

  it('sorts by name only when explicitly selected', () => {
    const { filteredAgents, sortMode } = createDirectory()
    sortMode.value = 'name'
    expect(filteredAgents.value.map(item => item.agentId)).toEqual(['host-a', 'host-b'])
  })

  it('sorts a copy without modifying the original list', () => {
    const { allAgents, sortAgents } = createDirectory()
    expect(sortAgents(allAgents.value).map(item => item.agentId)).toEqual(['host-b', 'host-a'])
    expect(allAgents.value.map(item => item.agentId)).toEqual(['host-a', 'host-b'])
  })
})
