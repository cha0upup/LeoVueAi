export const FILE_PREVIEW_DEFAULT_FONT_SIZE = 14
export const FILE_PREVIEW_DEFAULT_LINE_ENDING = 'LF'
export const FILE_PREVIEW_LINE_ENDING_OPTIONS = Object.freeze([
  { value: 'LF', label: 'LF' },
  { value: 'CRLF', label: 'CRLF' },
  { value: 'CR', label: 'CR' }
])

const LINE_ENDINGS = Object.freeze({ LF: '\n', CRLF: '\r\n', CR: '\r' })

export function getPreviewDisplayName(path) {
  return String(path || '').replace(/\\/g, '/').split('/').filter(Boolean).at(-1) || '文件编辑'
}

export function getPreviewTypeLabel(fileType) {
  if (fileType === 'image') return '图片预览'
  if (fileType === 'pdf') return 'PDF预览'
  return '文本编辑'
}

export function isTextFilePreview(fileType) {
  return fileType !== 'image' && fileType !== 'pdf'
}

export function shortenPreviewPath(path, maxLength = 50, edgeLength = 20) {
  const value = String(path || '')
  if (value.length <= maxLength) return value
  return `${value.slice(0, edgeLength)}...${value.slice(-edgeLength)}`
}

function getPreferredLineEnding(path) {
  return /\.(bat|cmd)$/i.test(path || '') ? 'CRLF' : FILE_PREVIEW_DEFAULT_LINE_ENDING
}

export function detectFileLineEnding(content, path = '') {
  if (!content) return getPreferredLineEnding(path)
  if (content.includes('\r\n')) return 'CRLF'
  if (content.includes('\r')) return 'CR'
  return 'LF'
}

export function normalizeFileLineEndings(content, targetLineEnding) {
  const newline = LINE_ENDINGS[targetLineEnding] || LINE_ENDINGS[FILE_PREVIEW_DEFAULT_LINE_ENDING]
  return String(content ?? '').replace(/\r\n|\r|\n/g, newline)
}

export function getTextPreviewStats(content) {
  const value = String(content ?? '')
  return {
    lineCount: value.length ? value.split(/\r\n|\r|\n/).length : 1,
    charCount: value.length
  }
}

export function resolvePreviewFileSize(responseData, fallbackMeta = {}) {
  const rawSize = responseData?.size ?? responseData?.length ?? responseData?.fileSize ??
    fallbackMeta?.size ?? fallbackMeta?.length ?? fallbackMeta?.fileSize
  const size = Number(rawSize)
  return Number.isFinite(size) && size >= 0 ? size : 0
}

export function splitPreviewDownloadPath(path) {
  const normalized = String(path || '').replace(/\\/g, '/')
  const separatorIndex = normalized.lastIndexOf('/')
  if (separatorIndex < 0) return { directoryPath: '', fileName: normalized || 'file' }
  return {
    directoryPath: normalized.slice(0, separatorIndex + 1),
    fileName: normalized.slice(separatorIndex + 1) || 'file'
  }
}

export function isSamePreviewTarget(left, right) {
  return left?.sessionId === right?.sessionId && left?.filePath === right?.filePath
}
