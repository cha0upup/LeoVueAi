export const SCAN_STAGES = [
  { name: 'REACHABILITY', label: '主机探活' },
  { name: 'PORT_SCAN', label: '端口扫描' },
  { name: 'SERVICE_PROBE', label: '服务识别' },
  { name: 'FINGERPRINT', label: '组件识别' }
]

export const DEFAULT_SCAN_STAGES = ['REACHABILITY', 'PORT_SCAN', 'SERVICE_PROBE']

export function terminalScanStageText(taskStatus, stageStatus) {
  if (stageStatus === 'FAILED') return '扫描失败'
  if (stageStatus === 'CANCELLED') return '已取消'
  if (['failed', 'cancelled'].includes(taskStatus) && (!stageStatus || stageStatus === 'PENDING')) return '未执行'
  return null
}

export function interruptedScanProgress(stages) {
  if (!Array.isArray(stages) || !stages.length) return null
  const total = stages.reduce((sum, stage) => sum + (
    ['COMPLETED', 'SKIPPED'].includes(stage.status)
      ? 100 : Math.max(0, Math.min(100, Number(stage.progress) || 0))
  ), 0)
  return Math.min(99, Math.floor(total / stages.length))
}

export function selectScanStages(stages = DEFAULT_SCAN_STAGES) {
  return SCAN_STAGES.filter(stage => stages.includes(stage.name))
}

export function toggleScanStage(stages, name, enabled) {
  const selected = new Set(stages)
  if (enabled) {
    selected.add(name)
    if (name === 'FINGERPRINT') selected.add('SERVICE_PROBE')
    if (name === 'SERVICE_PROBE' || name === 'FINGERPRINT') selected.add('PORT_SCAN')
  } else {
    selected.delete(name)
    if (name === 'PORT_SCAN') selected.delete('SERVICE_PROBE')
    if (name === 'PORT_SCAN' || name === 'SERVICE_PROBE') selected.delete('FINGERPRINT')
  }
  return SCAN_STAGES.filter(stage => selected.has(stage.name)).map(stage => stage.name)
}
