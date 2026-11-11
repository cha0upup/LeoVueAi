export function createLatestRequestGuard(types = []) {
  const sequences = Object.fromEntries(types.map(type => [type, 0]))
  const pending = new Map()

  function next(type) {
    sequences[type] = (sequences[type] || 0) + 1
    return sequences[type]
  }

  return {
    next,
    isCurrent(type, sequence) {
      return sequences[type] === sequence
    },
    // Share pending work; invalidate releases it, and action(isCurrent) can discard stale results.
    coalesce(type, action) {
      if (pending.has(type)) return pending.get(type)
      const sequence = next(type)
      const request = (async () => action(() => sequences[type] === sequence))()
      pending.set(type, request)
      const clear = () => { if (pending.get(type) === request) pending.delete(type) }
      request.then(clear, clear)
      return request
    },
    invalidate(typesToInvalidate = types) {
      typesToInvalidate.forEach(type => {
        next(type)
        pending.delete(type)
      })
    }
  }
}
