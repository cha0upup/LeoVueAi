const analysisOf = result => {
  const analysis = result?.analysis
  return analysis && typeof analysis === 'object' ? analysis : {}
}

const completedMatches = result => {
  const matches = analysisOf(result).matches
  return Array.isArray(matches) ? matches.filter(match => match?.complete) : []
}

export const getFingerprintAnalysis = (result, fallbackTotal = 0) => {
  const analysis = analysisOf(result)
  const matches = completedMatches(result)
  const entries = matches.map(match => ({
    key: String(match.targetId || ''),
    ruleId: String(match.ruleId || ''),
    hit: Boolean(match.matched),
    error: match.error || null
  })).filter(entry => entry.key)
  const total = Number(analysis.total ?? fallbackTotal)
  const completed = Number(analysis.completed ?? entries.length)
  const hitCount = entries.filter(entry => entry.hit).length
  return {
    total: Number.isFinite(total) ? total : fallbackTotal,
    completed: Number.isFinite(completed) ? completed : entries.length,
    hitCount,
    missCount: Math.max(0, completed - hitCount),
    entries
  }
}

export const getReconAnalysis = (result, fallback = {}) => {
  const analysis = analysisOf(result)
  const matches = completedMatches(result)
  const results = {}
  const matched = {}
  matches.forEach(match => {
    const targetId = String(match.targetId || '')
    const ruleId = String(match.ruleId || '')
    if (!targetId || !ruleId) return
    if (!results[targetId]) results[targetId] = {}
    results[targetId][ruleId] = Boolean(match.matched)
    if (match.matched) {
      if (!matched[targetId]) matched[targetId] = []
      matched[targetId].push(ruleId)
    }
  })
  const total = Number(analysis.total ?? 0)
  const completed = Number(analysis.completed ?? matches.length)
  const targetCount = Number(analysis.targetCount ?? fallback.targetCount ?? 0)
  const ruleCount = Number(analysis.ruleCount ?? fallback.ruleCount ?? 0)
  return {
    total: Number.isFinite(total) ? total : 0,
    completed: Number.isFinite(completed) ? completed : matches.length,
    targetCount: Number.isFinite(targetCount) ? targetCount : 0,
    ruleCount: Number.isFinite(ruleCount) ? ruleCount : 0,
    hitTargets: Object.keys(matched).length,
    results,
    matched
  }
}
