import { describe, expect, it } from 'vitest'
import { normalizePlan } from './aiTurnModel.js'

describe('aiTurnModel plan normalization', () => {
  it('preserves the current plan step status', () => {
    expect(normalizePlan({ steps: [{ index: 0, status: 'IN_PROGRESS' }] }).steps[0].status)
      .toBe('IN_PROGRESS')
  })
})
