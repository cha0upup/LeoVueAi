import { describe, expect, it } from 'vitest'
import { buildSkillManifest, buildSkillMarkdown } from './skillManifestSerializer.js'

const manifestData = (overrides = {}) => ({
  id: 'leo.custom.puppet-node.demo',
  name: 'demo',
  version: '0.1.0',
  scope: 'puppet-node',
  domain: 'operation',
  category: 'discovery',
  mode: 'assess',
  tactics: [],
  techniques: ['T1082'],
  platforms: ['linux'],
  targets: ['host'],
  pack: 'host-assessment',
  risk: 'low',
  accessMode: 'read-only',
  status: 'draft',
  source: 'custom',
  owner: 'leo',
  enabled: false,
  requiredTools: [],
  requiredSkills: [],
  requiredFacts: [],
  produces: ['host-profile'],
  next: [],
  ...overrides
})

describe('skillManifestSerializer', () => {
  it('serializes the complete governed manifest shape', () => {
    const yaml = buildSkillManifest(manifestData())
    expect(yaml).toContain('name: "demo"')
    expect(yaml).toContain('  techniques: ["T1082"]')
    expect(yaml).toContain('enabled: false')
    expect(yaml).toContain('produces: ["host-profile"]')
  })

  it('escapes quoted frontmatter values', () => {
    const markdown = buildSkillMarkdown('demo', 'collect "host" data')
    expect(markdown).toContain('description: "collect \\"host\\" data"')
  })

  it('omits an empty optional pack', () => {
    expect(buildSkillManifest(manifestData({ pack: '' }))).not.toContain('\npack:')
  })
})
