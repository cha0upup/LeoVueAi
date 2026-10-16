export const ARTIFACT_CATEGORIES = Object.freeze([
  { path: 'script-builds', label: '脚本产物', icon: 'codeFile' },
  { path: 'ai-reports', label: 'AI 分析报告', icon: 'chatAi' },
  { path: 'task-results', label: '任务输出', icon: 'task' },
  { path: 'imports', label: '导入与其他', icon: 'folderOpened' }
])

export const ARTIFACT_SOURCE_LABELS = Object.freeze({
  'script-generator': '脚本构建',
  'platform-ai': '平台 AI',
  'node-ai': '节点 AI',
  'task-output': '任务输出',
  manual: '手动导入',
  unrecorded: '来源未记录'
})
