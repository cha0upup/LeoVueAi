function hasSkillWarnings(skill) {
  const issues = Array.isArray(skill?.issues) ? skill.issues : []
  return issues.some(
    (issue) => String(issue?.severity || '').toUpperCase() === 'WARNING'
  )
}

export function getSkillAvailability(skill) {
  if (!skill?.valid) {
    return {
      key: 'invalid',
      label: '不可运行',
      type: 'danger',
      runtimeEligible: false,
      description: 'Skill 校验未通过'
    }
  }
  if (skill.status === 'deprecated') {
    return {
      key: 'deprecated',
      label: '已弃用',
      type: 'info',
      runtimeEligible: false,
      description: '已退出运行目录'
    }
  }
  if (skill.status !== 'published') {
    const reviewed = skill.status === 'reviewed'
    return {
      key: reviewed ? 'reviewed' : 'draft',
      label: reviewed ? '待发布' : '草稿',
      type: reviewed ? 'warning' : 'info',
      runtimeEligible: false,
      description: reviewed ? '已审核，等待发布' : '尚未完成审核发布'
    }
  }
  if (skill.enabled !== true) {
    return {
      key: 'disabled',
      label: '已禁用',
      type: 'info',
      runtimeEligible: false,
      description: '已发布，但未进入运行目录'
    }
  }
  if (skill.requiresExplicitApproval || hasSkillWarnings(skill)) {
    return {
      key: 'controlled',
      label: '受控启用',
      type: 'warning',
      runtimeEligible: true,
      description: '运行时需要精确授权或显式确认'
    }
  }
  return {
    key: 'available',
    label: '可运行',
    type: 'success',
    runtimeEligible: true,
    description: '已发布、已启用且校验通过'
  }
}

export function summarizeSkillCatalog(skills) {
  const summary = {
    total: 0,
    runtime: 0,
    controlled: 0,
    problems: 0
  }
  for (const skill of skills || []) {
    summary.total += 1
    const availability = getSkillAvailability(skill)
    if (availability.runtimeEligible) summary.runtime += 1
    if (availability.key === 'controlled') summary.controlled += 1
    if (availability.key === 'invalid' || hasSkillWarnings(skill)) summary.problems += 1
  }
  return summary
}

export function summarizeSelectedRisk(skills) {
  const summary = {
    highRisk: 0,
    approvalRequired: 0,
    activeLogin: 0,
    writeCapable: 0
  }
  for (const skill of skills || []) {
    if (['high', 'critical'].includes(skill.risk)) summary.highRisk += 1
    if (skill.requiresExplicitApproval) summary.approvalRequired += 1
    if (skill.accessMode === 'active-login') summary.activeLogin += 1
    if (['write', 'write-destructive', 'destructive'].includes(skill.accessMode)) {
      summary.writeCapable += 1
    }
  }
  return summary
}

export function filterSkills(skills, filters) {
  const normalized = filters || {}
  return (skills || []).filter((skill) => {
    if (normalized.domain && skill.domain !== normalized.domain) return false
    if (normalized.category && skill.category !== normalized.category) return false
    if (normalized.platform && !(skill.platforms || []).includes(normalized.platform)) return false
    if (normalized.risk && skill.risk !== normalized.risk) return false
    if (normalized.status && skill.status !== normalized.status) return false
    if (normalized.accessMode && skill.accessMode !== normalized.accessMode) return false
    if (normalized.pack && skill.pack !== normalized.pack) return false
    if (normalized.approval === 'required' && !skill.requiresExplicitApproval) return false
    if (normalized.approval === 'not-required' && skill.requiresExplicitApproval) return false
    if (normalized.health === 'warning' && !hasSkillWarnings(skill)) return false
    if (normalized.health === 'invalid' && skill.valid) return false
    if (normalized.health === 'problems' && skill.valid && !hasSkillWarnings(skill)) return false
    if (normalized.health === 'healthy' && (!skill.valid || hasSkillWarnings(skill))) return false
    if (normalized.availability) {
      const availability = getSkillAvailability(skill)
      if (normalized.availability === 'runtime') {
        if (!availability.runtimeEligible) return false
      } else if (availability.key !== normalized.availability) {
        return false
      }
    }
    return true
  })
}

export function keepVisibleSelection(selectedNames, visibleSkills) {
  const visibleNames = new Set((visibleSkills || []).map((skill) => skill.name))
  return new Set(Array.from(selectedNames || []).filter((name) => visibleNames.has(name)))
}

export function issueTargetFile(issue) {
  const field = String(issue?.field || '')
  return field.startsWith('SKILL.md') ? 'SKILL.md' : 'manifest.yaml'
}
