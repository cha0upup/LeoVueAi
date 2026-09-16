import { beforeEach, describe, expect, it, vi } from 'vitest'

const { post } = vi.hoisted(() => ({ post: vi.fn() }))
vi.mock('../http.js', () => ({ default: { post } }))

import { execCommandApi } from './puppet-node.js'

describe('terminal request timeouts', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each([
    ['read', '10000', { timeout: 30000 }],
    ['read', '750', { timeout: 30000 }],
    ['read', '', undefined],
    ['read', '0', undefined],
    ['init', '', { timeout: 45000 }],
    ['write', 'init', { timeout: 45000 }],
    ['write-line', 'echo hello\n', { timeout: 45000 }],
    ['stop', '', undefined],
    ['resize', '80,24', undefined]
  ])('sets timeout for %s with command %j', (type, cmd, config) => {
    const params = { sessionId: 'host', processId: 'process', type, cmd }
    execCommandApi(params)
    expect(post).toHaveBeenCalledWith('/puppet-node/command/exec-command', params, config)
  })

  it('batches negotiated reads while sending long polls and input immediately', async () => {
    post.mockImplementation(async (url, params) => ({
      data: url.endsWith('read-batch')
        ? {
            code: 200,
            terminals: Object.fromEntries(params.processIds.map((id) => [id, { code: 200 }]))
          }
        : { code: 200 }
    }))
    const base = { sessionId: 'host', type: 'read', cmd: '', batchRead: true }
    const first = execCommandApi({ ...base, processId: 'a' })
    const second = execCommandApi({ ...base, processId: 'b' })
    execCommandApi({ ...base, processId: 'c', cmd: '10000' })
    execCommandApi({
      ...base,
      processId: 'a',
      type: 'write-line',
      cmd: 'echo hello\n',
      includeOutput: true
    })
    expect(post).toHaveBeenCalledTimes(2)
    expect(post.mock.calls[1][1].includeOutput).toBe(true)
    expect(post.mock.calls.every(([, params]) => params.batchRead === undefined)).toBe(true)
    await Promise.all([first, second])
    expect(post).toHaveBeenCalledWith('/puppet-node/command/read-batch', {
      sessionId: 'host',
      processIds: ['a', 'b']
    })
  })

  it('retains individual reads when the node has not advertised batching', () => {
    for (const id of ['a', 'b'])
      execCommandApi({ sessionId: 'legacy', processId: id, type: 'read', cmd: '' })
    expect(post).toHaveBeenCalledTimes(2)
    expect(post.mock.calls.every(([url]) => url.endsWith('exec-command'))).toBe(true)
  })
})
