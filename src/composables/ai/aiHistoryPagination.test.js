import { describe, expect, it, vi } from 'vitest'
import { fetchCompleteAiHistory } from './aiHistoryPagination.js'

const record = sequence => ({ messageId: `message-${sequence}`, sequence, role: 'assistant', content: `answer ${sequence}` })

describe('AI history cursor pagination', () => {
  it('reads every page in chronological order without including later appends', async () => {
    const loadPage = vi.fn()
      .mockResolvedValueOnce({ data: { messages: [record(201), record(202)], hasMore: true, nextBeforeSequence: 201 } })
      .mockResolvedValueOnce({ messages: [record(2), record(3)], hasMore: true, nextBeforeSequence: 2 })
      .mockResolvedValueOnce({ messages: [record(1)], hasMore: false, nextBeforeSequence: 1 })
    const all = await fetchCompleteAiHistory(loadPage)
    expect(all.map(message => message.sequence)).toEqual([1, 2, 3, 201, 202])
    expect(loadPage.mock.calls.map(([params]) => params)).toEqual([
      { offset: 0, limit: 200 }, { beforeSequence: 201, limit: 200 }, { beforeSequence: 2, limit: 200 }
    ])
  })

  it('does not return a partial report when a later page fails', async () => {
    const loadPage = vi.fn()
      .mockResolvedValueOnce({ messages: [record(201)], hasMore: true, nextBeforeSequence: 201 })
      .mockRejectedValueOnce(new Error('page unavailable'))
    await expect(fetchCompleteAiHistory(loadPage)).rejects.toThrow('page unavailable')
  })

  it.each([
    { messages: [record(201)], total: 201 },
    { messages: {}, hasMore: false }
  ])('rejects an invalid export page instead of producing a partial report: %j', async page => {
    await expect(fetchCompleteAiHistory(async () => page)).rejects.toThrow('分页响应格式异常')
  })

  it.each([
    { messages: [], hasMore: true, nextBeforeSequence: 3 },
    { messages: [record(3)], hasMore: true, nextBeforeSequence: null },
    { messages: [record(3)], hasMore: true, nextBeforeSequence: '3' }
  ])('rejects non-progressing cursors instead of looping or exporting incomplete history', async page => {
    await expect(fetchCompleteAiHistory(vi.fn(async () => page))).rejects.toThrow('游标异常')
  })

  it('stops exporting after a repeated cursor', async () => {
    const page = { messages: [record(3)], hasMore: true, nextBeforeSequence: 3 }
    const loadPage = vi.fn().mockResolvedValueOnce(page).mockResolvedValueOnce(page)
    await expect(fetchCompleteAiHistory(loadPage)).rejects.toThrow('游标异常')
    expect(loadPage).toHaveBeenCalledTimes(2)
  })
})
