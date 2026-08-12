import { describe, expect, it } from 'vitest'
import {
  filterSkills,
  getSkillAvailability,
  keepVisibleSelection,
  summarizeSelectedRisk,
  summarizeSkillCatalog
} from './skillUiModel.js'

const skill = (overrides = {}) => ({
  name: 'demo',
  valid: true,
  enabled: true,
  status: 'published',
  risk: 'low',
  accessMode: 'read-only',
  requiresExplicitApproval: false,
  issues: [],
  platforms: ['linux'],
  domain: 'operation',
  category: 'discovery',
  pack: 'linux-postex',
  ...overrides
})

describe('skillUiModel', () => {
  it('distinguishes runtime availability from lifecycle and validation state', () => {
    expect(getSkillAvailability(skill()).key).toBe('available')
    expect(getSkillAvailability(skill({ risk: 'high', requiresExplicitApproval: true })).key).toBe(
      'controlled'
    )
    expect(getSkillAvailability(skill({ enabled: false })).key).toBe('disabled')
    expect(getSkillAvailability(skill({ status: 'draft', enabled: false })).key).toBe('draft')
    expect(getSkillAvailability(skill({ valid: false })).key).toBe('invalid')
  })

  it('summarizes warnings and runtime eligibility independently', () => {
    const summary = summarizeSkillCatalog([
      skill(),
      skill({ name: 'controlled', risk: 'high', requiresExplicitApproval: true }),
      skill({ name: 'broken', valid: false, enabled: false })
    ])
    expect(summary).toMatchObject({
      total: 3,
      runtime: 2,
      controlled: 1,
      problems: 1
    })
  })

  it('counts a skill with both errors and warnings as one problem', () => {
    const summary = summarizeSkillCatalog([
      skill({
        valid: false,
        issues: [
          { severity: 'ERROR', message: 'broken' },
          { severity: 'WARNING', message: 'review' }
        ]
      })
    ])
    expect(summary).toEqual({ total: 1, runtime: 0, controlled: 0, problems: 1 })
  })

  it('filters governance fields and never retains hidden selections', () => {
    const skills = [skill(), skill({ name: 'windows', platforms: ['windows'], risk: 'high' })]
    const visible = filterSkills(skills, { platform: 'linux', approval: '', health: '' })
    expect(visible.map((item) => item.name)).toEqual(['demo'])
    expect(Array.from(keepVisibleSelection(new Set(['demo', 'windows']), visible))).toEqual(['demo'])
  })

  it('uses a single problems filter for warnings and blocking errors', () => {
    const skills = [
      skill(),
      skill({ name: 'warning', issues: [{ severity: 'WARNING' }] }),
      skill({ name: 'broken', valid: false })
    ]
    expect(filterSkills(skills, { health: 'problems' }).map((item) => item.name)).toEqual([
      'warning',
      'broken'
    ])
  })

  it('summarizes high-risk batch targets before enabling', () => {
    const summary = summarizeSelectedRisk([
      skill({ name: 'ssh', risk: 'high', accessMode: 'active-login', requiresExplicitApproval: true }),
      skill({ name: 'persist', risk: 'critical', accessMode: 'write', requiresExplicitApproval: true })
    ])
    expect(summary).toMatchObject({
      highRisk: 2,
      approvalRequired: 2,
      activeLogin: 1,
      writeCapable: 1
    })
  })
})
