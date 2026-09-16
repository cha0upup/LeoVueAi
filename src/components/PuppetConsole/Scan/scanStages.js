export const SCAN_STAGES = [
  { name: 'REACHABILITY', label: '主机探活' },
  { name: 'PORT_SCAN', label: '端口扫描' },
  { name: 'SERVICE_PROBE', label: '服务识别' }
]

export function selectScanStages(stages = SCAN_STAGES.map(stage => stage.name)) {
  return SCAN_STAGES.filter(stage => stages.includes(stage.name))
}

export function toggleScanStage(stages, name, enabled) {
  const selected = new Set(stages)
  if (enabled) {
    selected.add(name)
    if (name === 'SERVICE_PROBE') selected.add('PORT_SCAN')
  } else {
    selected.delete(name)
    if (name === 'PORT_SCAN') selected.delete('SERVICE_PROBE')
  }
  return SCAN_STAGES.filter(stage => selected.has(stage.name)).map(stage => stage.name)
}
