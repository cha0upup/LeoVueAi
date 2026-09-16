import { requireTerminalSuccess } from './terminalResponse.js'

const MAX_BATCH_SIZE = 16

/** Combine reads from one scheduling turn, keeping each node session isolated. */
export function createTerminalReadBatcher({ readOne, readBatch }) {
  const groups = new Map()
  let scheduled = false

  const dispatch = async (sessionId, entries) => {
    try {
      if (entries.length === 1) {
        entries[0].resolve(await readOne(entries[0].params))
        return
      }
      const response = await readBatch(
        sessionId,
        entries.map(({ params }) => params.processId)
      )
      const payload = requireTerminalSuccess(response?.data)
      if (
        !payload.terminals ||
        typeof payload.terminals !== 'object' ||
        Array.isArray(payload.terminals)
      ) {
        throw new Error('批量终端读取返回了无效结果')
      }
      for (const entry of entries) {
        const id = entry.params.processId
        const result = Object.hasOwn(payload.terminals, id) ? payload.terminals[id] : null
        if (!result || typeof result !== 'object' || result.code === undefined) {
          entry.reject(new Error('批量读取缺少终端结果'))
        } else {
          entry.resolve({ data: result })
        }
      }
    } catch (error) {
      // Reads consume output. Retrying as individual reads could silently lose it.
      for (const entry of entries) entry.reject(error)
    }
  }

  const flush = () => {
    const pending = [...groups]
    groups.clear()
    scheduled = false
    for (const [sessionId, group] of pending) {
      const entries = [...group.values()]
      for (let index = 0; index < entries.length; index += MAX_BATCH_SIZE) {
        dispatch(sessionId, entries.slice(index, index + MAX_BATCH_SIZE))
      }
    }
  }

  return (params) => {
    let group = groups.get(params.sessionId)
    if (!group) {
      group = new Map()
      groups.set(params.sessionId, group)
    }
    if (group.has(params.processId)) return group.get(params.processId).promise
    const entry = { params }
    entry.promise = new Promise((resolve, reject) => {
      entry.resolve = resolve
      entry.reject = reject
    })
    group.set(params.processId, entry)
    if (!scheduled) {
      scheduled = true
      globalThis.queueMicrotask(flush)
    }
    return entry.promise
  }
}
