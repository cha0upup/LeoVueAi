export const AI_HISTORY_PAGE_SIZE = 50

export function normalizeAiHistoryPage(response) {
  const page = response?.data ?? response ?? {}
  if (!Array.isArray(page.messages) || typeof page.hasMore !== 'boolean') {
    throw new Error('历史消息分页响应格式异常')
  }
  const result = {
    messages: page.messages,
    nextBeforeSequence: page.nextBeforeSequence ?? null,
    hasMore: page.hasMore
  }
  if (result.hasMore) requireOlderCursor(result)
  return result
}

export function mergeAiHistoryRecords(records) {
  const seen = new Map()
  for (const record of records) {
    if (!record?.messageId) throw new Error('历史消息缺少稳定标识')
    seen.set(record.messageId, record)
  }
  return [...seen.values()].sort((left, right) => Number(left.sequence) - Number(right.sequence))
}

export function requireOlderCursor(page, previousCursor = null) {
  const cursor = page.nextBeforeSequence
  if (!page.messages.length || !Number.isSafeInteger(cursor) || cursor <= 0 ||
      (previousCursor != null && cursor >= previousCursor)) {
    throw new Error('历史消息游标异常，请重新加载对话')
  }
  return cursor
}

/** 以首屏的最新消息为边界读取完整历史；后续新增消息不会挤动旧页。 */
export async function fetchCompleteAiHistory(loadPage) {
  let beforeSequence = null
  const records = []
  while (true) {
    const page = normalizeAiHistoryPage(await loadPage({
      limit: 200,
      ...(beforeSequence != null ? { beforeSequence } : { offset: 0 })
    }))
    records.push(...page.messages)
    if (!page.hasMore) return mergeAiHistoryRecords(records)
    beforeSequence = requireOlderCursor(page, beforeSequence)
  }
}
