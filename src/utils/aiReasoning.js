const EFFORTS = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max']

/** Capability flags alone do not establish which effort levels a model accepts. */
export function reasoningEffortOptions(contract, thinkingEnabled = null) {
  const options = [{ value: 'auto', label: 'auto' }]
  if (!Array.isArray(contract?.reasoningEfforts)
    || ['conservative', 'gateway'].includes(contract.source)
    || (thinkingEnabled === 0 && !contract.thinkingRequired)) return options
  return options.concat(EFFORTS.filter(value => contract.reasoningEfforts.includes(value))
    .map(value => ({ value, label: value })))
}

export function chatReasoningOptions(config) {
  const supportsReasoning = config?.supportsReasoning === true || config?.supportsReasoning === 1
  return reasoningEffortOptions(supportsReasoning ? config?.requestOptions : null,
    config?.thinkingEnabled)
}
