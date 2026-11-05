import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ post: vi.fn() }))
vi.mock('../http.js', () => ({ default: { post: mocks.post } }))
import {
  listSshProfilesApi,
  getSshProfileApi,
  saveSshProfileApi,
  deleteSshProfileApi,
  connectSshTerminalApi,
  execSshTerminalApi
} from './ssh-terminal.js'

describe('SSH terminal API', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists scoped metadata without a host probe', () => {
    const signal = new AbortController().signal
    listSshProfilesApi('parent', signal)
    expect(mocks.post.mock.calls).toEqual([
      ['/agent-node/terminal/ssh/profiles', { sessionId: 'parent' }, { signal }]
    ])
  })

  it('uses the stored server pin without a preliminary probe or secret submission', () => {
    connectSshTerminalApi({
      sessionId: 'parent',
      processId: 'child',
      profileId: 'profile',
      version: 1,
      password: 'ignored'
    })
    expect(mocks.post).toHaveBeenCalledExactlyOnceWith(
      '/agent-node/terminal/ssh/profiles/connect',
      { sessionId: 'parent', processId: 'child', profileId: 'profile', version: 1 },
      { timeout: 60000 }
    )
  })

  it('budgets long polls separately from control requests', () => {
    execSshTerminalApi({ sessionId: 'parent', processId: 'child', type: 'read' })
    execSshTerminalApi({ sessionId: 'parent', processId: 'child', type: 'stop' })
    expect(mocks.post.mock.calls).toEqual([
      [
        '/agent-node/terminal/ssh/command',
        { sessionId: 'parent', processId: 'child', type: 'read' },
        { timeout: 30000 }
      ],
      [
        '/agent-node/terminal/ssh/command',
        { sessionId: 'parent', processId: 'child', type: 'stop' },
        { timeout: 45000 }
      ]
    ])
  })

  it('uses scoped CRUD endpoints and sends only IDs and a pin when reusing stored credentials', () => {
    const signal = new AbortController().signal
    const update = { sessionId: 'parent', profileId: 'profile', version: 2, password: 'new-secret' }
    getSshProfileApi('parent', 'profile', signal)
    saveSshProfileApi(update, signal)
    deleteSshProfileApi({ sessionId: 'parent', profileId: 'profile', version: 3 }, signal)
    connectSshTerminalApi({
      sessionId: 'parent',
      processId: 'child',
      profileId: 'profile',
      version: 3,
      fingerprint: 'pin',
      password: 'ignored',
      privateKey: 'ignored',
      host: 'ignored'
    })
    expect(mocks.post.mock.calls).toEqual([
      [
        '/agent-node/terminal/ssh/profiles/get',
        { sessionId: 'parent', profileId: 'profile' },
        { signal }
      ],
      ['/agent-node/terminal/ssh/profiles/save', update, { signal }],
      [
        '/agent-node/terminal/ssh/profiles/delete',
        { sessionId: 'parent', profileId: 'profile', version: 3 },
        { signal }
      ],
      [
        '/agent-node/terminal/ssh/profiles/connect',
        {
          sessionId: 'parent',
          processId: 'child',
          profileId: 'profile',
          version: 3,
          fingerprint: 'pin'
        },
        { timeout: 60000 }
      ]
    ])
  })
})
