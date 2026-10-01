import { describe, expect, it, vi } from 'vitest'
import { useEventLogFollow } from './useEventLogFollow.js'

function createFakeSource() {
  const listeners = new Map()
  return {
    addEventListener(type, listener) {
      listeners.set(type, listener)
    },
    close: vi.fn(),
    emit(type, data) {
      listeners.get(type)?.({ data })
    }
  }
}

describe('useEventLogFollow', () => {
  it('parses append/meta events and stops on transport errors', () => {
    const source = createFakeSource()
    const onAppend = vi.fn()
    const onMeta = vi.fn()
    const onError = vi.fn()
    const follow = useEventLogFollow({
      createSource: () => source,
      onAppend,
      onMeta,
      onError
    })

    follow.start({ source: '/a.log' })
    expect(follow.isFollowing.value).toBe(true)
    source.emit('append', JSON.stringify({ entries: [{ id: 1 }] }))
    source.emit('meta', JSON.stringify({ size: 12 }))
    source.emit('error', '')

    expect(onAppend).toHaveBeenCalledWith([{ id: 1 }], { entries: [{ id: 1 }] })
    expect(onMeta).toHaveBeenCalledWith({ size: 12 })
    expect(onError).toHaveBeenCalledOnce()
    expect(source.close).toHaveBeenCalledOnce()
    expect(follow.isFollowing.value).toBe(false)
  })

  it('ignores malformed and stale events after replacing a source', () => {
    const first = createFakeSource()
    const second = createFakeSource()
    const onAppend = vi.fn()
    const createSource = vi.fn()
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second)
    const follow = useEventLogFollow({ createSource, onAppend })

    follow.start({ source: '/first.log' })
    first.emit('append', '{bad json')
    follow.start({ source: '/second.log' })
    first.emit('append', JSON.stringify({ entries: [{ id: 'stale' }] }))
    second.emit('append', JSON.stringify({ entries: [{ id: 'current' }] }))

    expect(first.close).toHaveBeenCalledOnce()
    expect(onAppend).toHaveBeenCalledOnce()
    expect(onAppend).toHaveBeenCalledWith([{ id: 'current' }], { entries: [{ id: 'current' }] })
  })

  it('cleans up a partially created invalid source', () => {
    const invalidSource = { close: vi.fn() }
    const follow = useEventLogFollow({ createSource: () => invalidSource })
    expect(() => follow.start({})).toThrow('event source')
    expect(invalidSource.close).toHaveBeenCalledOnce()
    expect(follow.isFollowing.value).toBe(false)
  })

  it('closes the source even when the error observer throws', () => {
    const source = createFakeSource()
    const follow = useEventLogFollow({
      createSource: () => source,
      onError: () => { throw new Error('observer failed') }
    })

    follow.start({})
    expect(() => source.emit('error', '')).toThrow('observer failed')
    expect(source.close).toHaveBeenCalledOnce()
    expect(follow.isFollowing.value).toBe(false)
  })
})
