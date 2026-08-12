const yamlQuote = (value) =>
  `"${String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')}"`

const yamlArray = (values) => `[${(values || []).map(yamlQuote).join(', ')}]`

export function buildSkillMarkdown(name, description) {
  return `---\nname: ${yamlQuote(name)}\ndescription: ${yamlQuote(description)}\n---\n\n## 技能说明\n\n`
}

export function buildSkillManifest(skill) {
  return [
    'schemaVersion: 1',
    `id: ${yamlQuote(skill.id)}`,
    `name: ${yamlQuote(skill.name)}`,
    `version: ${yamlQuote(skill.version)}`,
    `scope: ${yamlQuote(skill.scope)}`,
    `domain: ${yamlQuote(skill.domain)}`,
    `category: ${yamlQuote(skill.category)}`,
    `mode: ${yamlQuote(skill.mode)}`,
    'attack:',
    `  tactics: ${yamlArray(skill.tactics)}`,
    `  techniques: ${yamlArray(skill.techniques)}`,
    `platforms: ${yamlArray(skill.platforms)}`,
    `targets: ${yamlArray(skill.targets)}`,
    ...(skill.pack ? [`pack: ${yamlQuote(skill.pack)}`] : []),
    `risk: ${yamlQuote(skill.risk)}`,
    `accessMode: ${yamlQuote(skill.accessMode)}`,
    `status: ${yamlQuote(skill.status)}`,
    `source: ${yamlQuote(skill.source)}`,
    `owner: ${yamlQuote(skill.owner)}`,
    `enabled: ${skill.enabled === true}`,
    'requires:',
    `  tools: ${yamlArray(skill.requiredTools)}`,
    `  skills: ${yamlArray(skill.requiredSkills)}`,
    `  facts: ${yamlArray(skill.requiredFacts)}`,
    `produces: ${yamlArray(skill.produces)}`,
    `next: ${yamlArray(skill.next)}`,
    ''
  ].join('\n')
}
