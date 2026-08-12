import { describe, expect, it } from 'vitest'
import { normalizePlan, normalizePlanStepStatus } from './aiTurnModel.js'

describe('aiTurnModel plan normalization', () => {
  it('maps backend IN_PROGRESS steps to the frontend RUNNING state', () => {
    expect(normalizePlanStepStatus('IN_PROGRESS')).toBe('RUNNING')
    expect(normalizePlan({ steps: [{ index: 0, status: 'IN_PROGRESS' }] }).steps[0].status)
      .toBe('RUNNING')
  })
})
