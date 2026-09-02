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
