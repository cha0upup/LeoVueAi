import { describe, expect, it } from 'vitest'

import {
  createDefaultPuppet,
  PUPPET_DEFAULT_MAX_REQUEST_COUNT,
  PUPPET_FORM_RULES
} from './constants.js'

describe('Puppet 最大请求数语义', () => {
  it('defaults to one total request', () => {
    expect(createDefaultPuppet().maxReqCount).toBe(PUPPET_DEFAULT_MAX_REQUEST_COUNT)
    expect(PUPPET_DEFAULT_MAX_REQUEST_COUNT).toBe(1)
  })

  it('requires a value between one and ten', () => {
    const rangeRule = PUPPET_FORM_RULES.maxReqCount.find((rule) => rule.type === 'number')
    expect(rangeRule).toMatchObject({ min: 1, max: 10 })
  })
})
