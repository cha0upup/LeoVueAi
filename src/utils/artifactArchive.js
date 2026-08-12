import { userFileCreateDirApi, userFileUploadApi } from '@/services/api.js'

export const ARTIFACT_CATEGORY = Object.freeze({
  SCRIPT_BUILDS: 'script-builds',
  AI_REPORTS: 'ai-reports',
  TASK_RESULTS: 'task-results'
})

const pad = (value, size = 2) => String(value).padStart(size, '0')

const formatArtifactTimestamp = (date = new Date()) => [
  date.getFullYear(),
  pad(date.getMonth() + 1),
  pad(date.getDate()),
  '-',
  pad(date.getHours()),
  pad(date.getMinutes()),
  pad(date.getSeconds()),
  '-',
  pad(date.getMilliseconds(), 3)
].join('')

export const sanitizeArtifactName = (value, fallback = 'artifact') => {
  const safe = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
  return safe || fallback
}

const normalizeExtension = (extension) =>
  String(extension || 'txt').replace(/^\.+/, '').replace(/[^a-z0-9]+/gi, '') || 'txt'

export async function archiveTextArtifact({
  category,
  name,
  extension = 'txt',
  content,
  mimeType = 'text/plain;charset=utf-8'
}) {
  if (!category) throw new Error('成果分类不能为空')
  if (!String(content || '').trim()) throw new Error('成果内容不能为空')

  const filename = `${formatArtifactTimestamp()}-${sanitizeArtifactName(name)}.${normalizeExtension(extension)}`
  await userFileCreateDirApi({ path: category })
  const file = new File([content], filename, { type: mimeType })
  await userFileUploadApi(file, { path: category })
  return { category, filename, path: `${category}/${filename}` }
}

const extractAssistantContent = (message) => {
  const direct = String(message?.content || '').trim()
  if (direct) return direct
  return (Array.isArray(message?.nodes) ? message.nodes : [])
    .filter(node => ['text', 'narration'].includes(node?.kind))
    .map(node => String(node?.content || '').trim())
    .filter(Boolean)
    .join('\n\n')
}

export function buildAiReportMarkdown({
  title,
  scope,
  threadId,
  sessionId,
  hostName,
  model,
  messages = []
}) {
  const lines = [
    `# ${title || 'AI 分析报告'}`,
    '',
    `- 报告类型：${scope || 'AI 分析'}`,
    `- 生成时间：${new Date().toLocaleString('zh-CN')}`,
    `- 对话线程：${threadId || '-'}`,
    `- 关联主机：${hostName || '-'}`,
    `- Session ID：${sessionId || '-'}`,
    `- 使用模型：${model || '-'}`,
    '',
    '---',
    ''
  ]

  let sequence = 0
  messages.forEach(message => {
    if (message?.role === 'user') {
      sequence += 1
      lines.push(`## 问题 ${sequence}`, '', String(message.content || '').trim(), '')
      return
    }
    if (message?.role === 'assistant') {
      const content = extractAssistantContent(message)
      if (content) lines.push(`## 分析 ${Math.max(sequence, 1)}`, '', content, '')
    }
  })

  return lines.join('\n').trim() + '\n'
}

const renderTaskValue = (value) => {
  if (value == null || value === '') return '-'
  if (typeof value === 'object') return `\n\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``
  return String(value)
}

export function buildTaskResultMarkdown(task, { typeLabel, statusLabel } = {}) {
  const fields = [
    ['任务类型', typeLabel || task?.kind],
    ['执行状态', statusLabel || task?.status],
    ['任务 ID', task?.taskId],
    ['关联主机', task?.puppetName],
    ['Session ID', task?.sessionId],
    ['连接地址', task?.connLink],
    ['任务内容', task?.detail || task?.title],
    ['进度', `${Number(task?.progress || 0)}%`],
    ['开始时间', task?.startedAt ? new Date(Number(task.startedAt)).toLocaleString('zh-CN') : '-'],
    ['结束时间', task?.finishedAt ? new Date(Number(task.finishedAt)).toLocaleString('zh-CN') : '-'],
    ['文件路径', task?.downloadPath || task?.filePath],
    ['文件大小', task?.fileSize],
    ['传输字节', task?.transferredBytes],
    ['退出码', task?.exitCode],
    ['结果摘要', task?.resultSummary],
    ['执行结果', task?.result],
    ['错误信息', task?.error]
  ]

  return [
    `# ${task?.title || '任务输出'}`,
    '',
    `- 归档时间：${new Date().toLocaleString('zh-CN')}`,
    '- 来源模块：任务总览',
    '',
    '## 任务结果',
    '',
    ...fields.map(([label, value]) => `- ${label}：${renderTaskValue(value)}`),
    ''
  ].join('\n')
}
