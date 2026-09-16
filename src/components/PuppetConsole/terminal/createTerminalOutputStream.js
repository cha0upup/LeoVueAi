/** Responses may arrive out of order; only ordered chunks reach the UTF-8 decoder. */
export function createTerminalOutputStream({ consume, onGap, onError }) {
  let nextSequence = 1
  let pendingRequests = 0
  let closed = false
  let ending = null
  const chunks = new Map()

  const deliver = (chunk) => {
    try {
      consume(chunk)
    } catch (error) {
      // A malformed chunk must not block later output or fail an acknowledged write.
      onError(error)
    }
  }

  const flush = () => {
    if (closed) return
    while (chunks.size) {
      if (!chunks.has(nextSequence)) {
        if (pendingRequests) return
        // All requests settled: the missing response cannot arrive. Resume with a visible gap.
        onGap()
        nextSequence = Math.min(...chunks.keys())
      }
      const chunk = chunks.get(nextSequence)
      chunks.delete(nextSequence++)
      deliver(chunk)
    }
    if (!pendingRequests && ending) {
      const last = ending
      ending = null
      deliver(last)
    }
  }

  return {
    begin() {
      pendingRequests += 1
    },
    push(chunk) {
      if (closed) return
      if (chunk.payload.missing === true) {
        ending = chunk
        return
      }
      const sequence = chunk.payload.outputSequence
      if (!Number.isSafeInteger(sequence) || sequence < 1) {
        throw new Error('终端输出缺少有效序号，请同步更新服务器和节点组件')
      }
      if (sequence < nextSequence || chunks.has(sequence)) return
      chunks.set(sequence, chunk)
      flush()
    },
    finish() {
      pendingRequests -= 1
      flush()
    },
    get waiting() {
      return chunks.size > 0 || ending !== null
    },
    close() {
      closed = true
      chunks.clear()
      ending = null
    }
  }
}
