import { ARTIFACT_CATEGORIES, ARTIFACT_SOURCE_LABELS } from '@/constants/artifacts.js'

const ARTIFACT_CATEGORY_LABELS = Object.fromEntries(ARTIFACT_CATEGORIES.map(item => [item.path, item.label]))

export const resolveArtifactSourceLabel = source => ARTIFACT_SOURCE_LABELS[source] || ARTIFACT_SOURCE_LABELS.unrecorded

const LANGUAGE_MAP = Object.freeze({
  js: 'javascript',
  ts: 'typescript',
  jsx: 'javascript',
  tsx: 'typescript',
  java: 'java',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',
  json: 'json',
  xml: 'xml',
  yml: 'yaml',
  yaml: 'yaml',
  md: 'markdown',
  markdown: 'markdown',
  sql: 'sql',
  sh: 'shell',
  bash: 'shell',
  py: 'python',
  go: 'go',
  rs: 'rust',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  vue: 'html',
  txt: 'plaintext',
  log: 'plaintext',
  ini: 'ini',
  conf: 'ini'
})

const EXTENSION_KIND_GROUPS = [
  ['picture', new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'])],
  ['video', new Set(['mp4', 'mov', 'avi', 'mkv', 'webm'])],
  ['compress', new Set(['zip', 'rar', '7z', 'tar', 'gz'])],
  ['filePdf', new Set(['pdf'])],
  ['fileWord', new Set(['doc', 'docx'])],
  ['fileExcel', new Set(['xls', 'xlsx'])],
  ['filePowerPoint', new Set(['ppt', 'pptx'])],
  ['markdown', new Set(['md', 'markdown'])],
  ['codeFile', new Set(['js', 'ts', 'json', 'vue', 'java', 'py', 'go', 'rs', 'sql'])],
  ['document', new Set(['txt', 'log'])]
]

export function getUserSpaceFileExtension(path) {
  const filename = String(path || '').split(/[\\/]/).pop() || ''
  const dotIndex = filename.lastIndexOf('.')
  if (dotIndex < 0 || dotIndex === filename.length - 1) return ''
  return filename.slice(dotIndex + 1).toLowerCase()
}

export function detectUserSpaceLanguage(path) {
  return LANGUAGE_MAP[getUserSpaceFileExtension(path)] || 'plaintext'
}

export function resolveArtifactCategoryLabel(name) {
  return ARTIFACT_CATEGORY_LABELS[name] || name
}

export function getUserSpaceEntryIconKey(entry) {
  if (entry?.isDirectory) return 'folder'
  const extension = getUserSpaceFileExtension(entry?.name)
  return EXTENSION_KIND_GROUPS.find(([, extensions]) => extensions.has(extension))?.[0] || 'file'
}

export function normalizeWorkspaceOverview(data) {
  const source = data && typeof data === 'object' ? data : {}
  const toNumber = (value) => {
    const number = Number(value)
    return Number.isFinite(number) && number >= 0 ? number : 0
  }
  return {
    totalFiles: toNumber(source.totalFiles),
    totalDirectories: toNumber(source.totalDirectories),
    totalBytes: toNumber(source.totalBytes),
    maxUploadBytes: toNumber(source.maxUploadBytes),
    rootItems: toNumber(source.rootItems),
    updatedAt: toNumber(source.updatedAt),
    recentFiles: Array.isArray(source.recentFiles) ? source.recentFiles : [],
    categories: Array.isArray(source.categories) ? source.categories : []
  }
}
