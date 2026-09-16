/** Lifecycle test fixture; ordering tests supply explicit wire sequences. */
export function testTerminalTransport(execute) {
  const sequences = new Map()
  return async (params) => {
    const response = await execute(params)
    const payload = { code: 200, ...response?.data }
    if (payload.code !== 200) return response
    if (params.type !== 'read' && !params.includeOutput) return { data: payload }
    const sequence = (sequences.get(params.processId) || 0) + 1
    sequences.set(params.processId, sequence)
    const output = { code: 200, eof: false, data: '', ...payload, outputSequence: sequence }
    return { data: params.type === 'read' ? output : { ...payload, output } }
  }
}
