export function createLatestRequestGuard(types = []) {
  const sequences = Object.fromEntries(types.map(type => [type, 0]))

  function next(type) {
    sequences[type] = (sequences[type] || 0) + 1
    return sequences[type]
  }

  return {
    next,
    isCurrent(type, sequence) {
      return sequences[type] === sequence
    },
    invalidate(typesToInvalidate = types) {
      typesToInvalidate.forEach(next)
    }
  }
}
