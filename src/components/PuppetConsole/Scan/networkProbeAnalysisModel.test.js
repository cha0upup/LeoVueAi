import { describe, expect, it } from 'vitest'

import { getFingerprintAnalysis, getReconAnalysis } from './networkProbeAnalysisModel.js'

describe('network probe analysis model', () => {
  it('maps completed fingerprint matches', () => {
    const analysis = getFingerprintAnalysis({
      analysis: {
        total: 2,
        completed: 1,
        matches: [
          { targetId: 'a:22', ruleId: 'ssh_any', complete: true, matched: true },
          { targetId: 'b:22', ruleId: 'ssh_any', complete: false, matched: false }
        ]
      }
    })

    expect(analysis).toMatchObject({ total: 2, completed: 1, hitCount: 1, missCount: 0 })
    expect(analysis.entries).toEqual([{ key: 'a:22', ruleId: 'ssh_any', hit: true, error: null }])
  })

  it('builds recon result maps from service analysis', () => {
    const analysis = getReconAnalysis({
      analysis: {
        total: 2,
        completed: 2,
        targetCount: 1,
        ruleCount: 2,
        matches: [
          { targetId: 'http://a', ruleId: 'nginx', complete: true, matched: true },
          { targetId: 'http://a', ruleId: 'tomcat', complete: true, matched: false }
        ]
      }
    })

    expect(analysis.results).toEqual({ 'http://a': { nginx: true, tomcat: false } })
    expect(analysis.matched).toEqual({ 'http://a': ['nginx'] })
    expect(analysis).toMatchObject({ total: 2, completed: 2, targetCount: 1, ruleCount: 2, hitTargets: 1 })
  })
})
