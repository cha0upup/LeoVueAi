import { describe, expect, it } from 'vitest'
import {
  filterSkills,
  getSkillAvailability,
  getSkillHealthKey,
  keepVisibleSelection,
  summarizeSelectedRisk,
  skillRiskTagType,
  skillToggleDisabledReason,
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
  it.each([
    ['critical', 'danger'], ['high', 'danger'], ['medium', 'warning'], ['low', 'success'], [undefined, 'success']
  ])('maps risk %s consistently across catalog and workspace views', (risk, type) => {
    expect(skillRiskTagType(risk)).toBe(type)
  })

  it('requires valid published metadata only when enabling a disabled skill', () => {
    expect(skillToggleDisabledReason(null)).toBe('')
    expect(skillToggleDisabledReason(skill({ enabled: true, valid: false, status: 'draft' }))).toBe('')
    expect(skillToggleDisabledReason(skill({ enabled: false, valid: false }))).toContain('校验失败')
    expect(skillToggleDisabledReason(skill({ enabled: false, status: 'reviewed' }))).toContain('published')
    expect(skillToggleDisabledReason(skill({ enabled: false }))).toBe('')
  })
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
    const requested = Object.freeze(['windows', 'demo', 'demo', 'missing'])
    expect(Array.from(keepVisibleSelection(requested, skills))).toEqual(['windows', 'demo'])
  })

  it('uses a single problems filter for warnings and blocking errors', () => {
    const skills = [
      skill(),
      skill({ name: 'warning', issues: [{ severity: 'WARNING' }] }),
      skill({ name: 'broken', valid: false, issues: [{ severity: 'warning' }] })
    ]
    expect(skills.map(getSkillHealthKey)).toEqual(['healthy', 'warning', 'invalid'])
    expect(filterSkills(skills, { health: 'warning' }).map(item => item.name)).toEqual(['warning', 'broken'])
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
