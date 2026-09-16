import { describe, expect, it, vi } from 'vitest'
import { createTerminalReadBatcher } from './terminalReadBatcher.js'

const command = (processId, sessionId = 'host') => ({ sessionId, processId, type: 'read', cmd: '' })
const success = (data = '') => ({ code: 200, data, instanceId: 'instance' })
function setup() {
  const readOne = vi.fn(async () => ({ data: success('one') }))
  const readBatch = vi.fn(async (sessionId, ids) => ({
    data: {
      code: 200,
      terminals: Object.fromEntries(ids.map((id) => [id, success(id)]))
    }
  }))
  return { readOne, readBatch, read: createTerminalReadBatcher({ readOne, readBatch }) }
}

describe('terminal read batches', () => {
  it('combines simultaneous reads per node and routes results by process ID', async () => {
    const { read, readOne, readBatch } = setup()
    const results = await Promise.all([
      read(command('a')),
      read(command('b')),
      read(command('a', 'other'))
    ])
    expect(readBatch).toHaveBeenCalledExactlyOnceWith('host', ['a', 'b'])
    expect(readOne).toHaveBeenCalledExactlyOnceWith(command('a', 'other'))
    expect(results.map((result) => result.data.data)).toEqual(['a', 'b', 'one'])
  })

  it('bounds batches to 16 processes and uses the single-read route for the remainder', async () => {
    const { read, readOne, readBatch } = setup()
    await Promise.all(Array.from({ length: 33 }, (_, i) => read(command(String(i)))))
    expect(readBatch.mock.calls.map(([, ids]) => ids.length)).toEqual([16, 16])
    expect(readOne).toHaveBeenCalledExactlyOnceWith(command('32'))
  })

  it('shares duplicate queued reads without consuming the output twice', async () => {
    const { read, readOne } = setup()
    const pending = read(command('same'))
    expect(read(command('same'))).toBe(pending)
    await pending
    expect(readOne).toHaveBeenCalledTimes(1)
  })

  it('preserves per-terminal errors and rejects a missing result without discarding other output', async () => {
    const { read, readBatch } = setup()
    readBatch.mockResolvedValue({
      data: {
        code: 200,
        terminals: {
          a: success('A'),
          b: { code: 500, msg: 'busy' }
        }
      }
    })
    const results = await Promise.allSettled(['a', 'b', 'c'].map((id) => read(command(id))))
    expect(results[0].value.data).toEqual(success('A'))
    expect(results[1].value.data).toEqual({ code: 500, msg: 'busy' })
    expect(results[2].reason.message).toContain('缺少终端结果')
  })

  it('rejects transport failures without falling back to another destructive read', async () => {
    const { read, readBatch, readOne } = setup()
    readBatch.mockRejectedValueOnce(new Error('network failed'))
    const results = await Promise.allSettled([read(command('a')), read(command('b'))])
    expect(results.every((result) => result.status === 'rejected')).toBe(true)
    expect(readOne).not.toHaveBeenCalled()
    await Promise.all([read(command('a')), read(command('b'))])
    expect(readBatch).toHaveBeenCalledTimes(2)
  })

  it.each([
    { data: { code: 500, msg: 'component failed' } },
    { data: { code: 200 } },
    { data: { code: '200', terminals: { a: success(), b: success() } } },
    { data: { code: 200, terminals: [] } }
  ])('rejects an invalid batch envelope', async (response) => {
    const { read, readBatch, readOne } = setup()
    readBatch.mockResolvedValue(response)
    const results = await Promise.allSettled([read(command('a')), read(command('b'))])
    expect(results.every((result) => result.status === 'rejected')).toBe(true)
    expect(readOne).not.toHaveBeenCalled()
  })
})
