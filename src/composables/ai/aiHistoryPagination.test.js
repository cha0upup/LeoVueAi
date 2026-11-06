import { describe, expect, it, vi } from 'vitest'
import { fetchCompleteAiHistory, mergeAiHistoryRecords, normalizeAiHistoryPage } from './aiHistoryPagination.js'

const record = sequence => ({ messageId: `message-${sequence}`, sequence, role: 'assistant', content: `answer ${sequence}` })

describe('AI history cursor pagination', () => {
  it.each([undefined, {}, { messages: [] }, { messages: {}, hasMore: false }, { messages: [], hasMore: 'false' }])(
    'rejects malformed current page responses: %j', page => {
      expect(() => normalizeAiHistoryPage(page)).toThrow('分页响应格式异常')
    }
  )

  it('keeps only cursor metadata and accepts the current HTTP envelope or its page', () => {
    const page = { messages: [record(3)], hasMore: false, nextBeforeSequence: 3, total: 99, offset: 0, limit: 50 }
    const expected = { messages: [record(3)], hasMore: false, nextBeforeSequence: 3 }
    expect(normalizeAiHistoryPage(page)).toEqual(expected)
    expect(normalizeAiHistoryPage({ data: page })).toEqual(expected)
  })

  it('rejects string cursors instead of coercing them', () => {
    expect(() => normalizeAiHistoryPage({ messages: [record(3)], hasMore: true, nextBeforeSequence: '3' }))
      .toThrow('游标异常')
  })

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

  it('rejects responses without the current cursor contract', async () => {
    await expect(fetchCompleteAiHistory(async () => ({ messages: [record(201)], total: 201 })))
      .rejects.toThrow('分页响应格式异常')
  })

  it.each([
    { messages: [], hasMore: true, nextBeforeSequence: 3 },
    { messages: [record(3)], hasMore: true, nextBeforeSequence: null }
  ])('rejects non-progressing cursors instead of looping or exporting incomplete history', async page => {
    await expect(fetchCompleteAiHistory(vi.fn(async () => page))).rejects.toThrow('游标异常')
  })

  it('rejects a repeated cursor and merges by stable message id', async () => {
    await expect(fetchCompleteAiHistory(vi.fn(async () => ({
      messages: [record(3)], hasMore: true, nextBeforeSequence: 3
    })))).rejects.toThrow('游标异常')
    expect(mergeAiHistoryRecords([record(2), record(1), { ...record(2), content: 'latest' }]))
      .toEqual([record(1), { ...record(2), content: 'latest' }])
  })
})
