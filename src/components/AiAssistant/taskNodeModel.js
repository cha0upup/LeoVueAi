export const getInitialNodeOpenState = kind =>
  !['thinking', 'tool', 'tool-group'].includes(String(kind || ''))

export const getThinkingPeek = (content, maxLength = 50) => {
  const firstLine = String(content ?? '').split(/[\n。.]/)[0].trim()
  return firstLine.length > maxLength ? `${firstLine.slice(0, maxLength)}…` : firstLine
}

export const getToolTone = node => {
  if (node?.status === 'failed' || node?.success === false) return 'danger'
  if (node?.status === 'running') return 'primary'
  if (node?.status === 'done') return 'success'
  return 'muted'
}

export const getToolStatusLabel = node => {
  if (node?.status === 'running') return '执行中'
  if (node?.status === 'done') return node?.success === false ? '失败' : '完成'
  if (node?.status === 'failed') return '失败'
  return '等待'
}

export const getSubtaskPresentation = status => {
  const normalized = String(status ?? '').toLowerCase()
  if (['failed', 'cancelled'].includes(normalized)) {
    return { tone: 'danger', label: normalized === 'cancelled' ? '已停止' : '失败' }
  }
  if (normalized === 'completed') return { tone: 'success', label: '已完成' }
  if (normalized === 'running') return { tone: 'primary', label: '执行中' }
  return { tone: 'muted', label: '等待' }
}

export const getToolKindIcon = name => {
  const normalized = String(name ?? '').toLowerCase()
  if (normalized.includes('scan') || normalized.includes('port')) return 'mdi:magnify-scan'
  if (/file|read|write/.test(normalized)) return 'mdi:file-outline'
  if (/exec|command|run/.test(normalized)) return 'mdi:console'
  if (/http|request/.test(normalized)) return 'mdi:web'
  if (/sql|database|db/.test(normalized)) return 'mdi:database-outline'
  if (normalized.includes('recon')) return 'mdi:target'
  return 'mdi:function-variant'
}

export const formatToolValue = (value, maxLength = Infinity) => {
  if (value == null || value === '') return ''
  let text
  if (typeof value === 'string') {
    try {
      text = JSON.stringify(JSON.parse(value), null, 2)
    } catch {
      text = value
    }
  } else {
    try {
      text = JSON.stringify(value, null, 2)
    } catch {
      text = String(value)
    }
  }
  return text.length > maxLength ? `${text.slice(0, maxLength)}\n…（已截断）` : text
}

export const getShellResultId = result => {
  if (!result) return null
  try {
    const value = typeof result === 'string' ? JSON.parse(result) : result
    const resultId = value?.resultId || value?.data?.resultId
    return typeof resultId === 'string' && resultId.trim() ? resultId.trim() : null
  } catch {
    return null
  }
}

export const getWorkspaceFileRef = result => {
  if (!result) return null
  try {
    const value = typeof result === 'string' ? JSON.parse(result) : result
    const candidate = value?.userWorkspacePath ? value : value?.data
    const path = candidate?.userWorkspacePath
    if (typeof path !== 'string' || !path.trim()) return null
    const normalized = path.trim()
    return {
      path: normalized,
      filename: normalized.split('/').filter(Boolean).at(-1) || 'workspace-file',
      sha256: typeof candidate?.sha256 === 'string' ? candidate.sha256 : null,
      size: Number.isFinite(Number(candidate?.size)) ? Number(candidate.size) : null
    }
  } catch {
    return null
  }
}
