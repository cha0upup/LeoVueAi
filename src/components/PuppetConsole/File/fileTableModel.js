import { buildFullPath } from '@/composables/useFilePath.js'
import { formatFilePath } from '@/utils/format.js'
import { getFileTypeNameByExtension } from '@/utils/fileIcons.js'

const EXTENSION_TAG_TYPES = Object.freeze({
  image: 'success',
  video: 'warning',
  audio: 'info',
  pdf: 'primary',
  word: 'primary',
  excel: 'primary',
  ppt: 'primary',
  markdown: 'primary',
  text: 'primary',
  json: 'danger',
  code: 'danger',
  executable: 'danger',
  font: 'info',
  book: 'info',
  archive: 'warning'
})

export function normalizeFileEntries(entries) {
  if (!Array.isArray(entries)) return []
  return entries.map(file => ({
    ...file,
    name: String(file?.name || file?.path || ''),
    path: String(file?.path || ''),
    size: Number(file?.size ?? 0),
    modified: file?.modified ?? 0,
    isDirectory: Boolean(file?.isDirectory),
    isFile: Boolean(file?.isFile),
    isSymlink: Boolean(file?.isSymlink),
    symlinkTarget: String(file?.symlinkTarget || ''),
    canRead: Boolean(file?.canRead),
    canWrite: Boolean(file?.canWrite),
    canExecute: Boolean(file?.canExecute),
    exists: Boolean(file?.exists),
    extension: String(file?.extension || '')
  }))
}

export function sortFileEntries(entries) {
  return [...(Array.isArray(entries) ? entries : [])].sort((left, right) => {
    if (left.isDirectory !== right.isDirectory) return left.isDirectory ? -1 : 1
    return String(left.name || '').localeCompare(String(right.name || ''), 'zh-CN')
  })
}

export function filterFileEntries(entries, { keyword = '', type = 'all' } = {}) {
  const normalizedKeyword = String(keyword || '').trim().toLocaleLowerCase()
  return (Array.isArray(entries) ? entries : []).filter(file => {
    if (type === 'dir' && !file.isDirectory) return false
    if (type === 'file' && file.isDirectory) return false
    if (!normalizedKeyword) return true
    return String(file.name || '').toLocaleLowerCase().includes(normalizedKeyword) ||
      String(file.extension || '').toLocaleLowerCase().includes(normalizedKeyword)
  })
}

export function summarizeFileEntries(entries) {
  const files = Array.isArray(entries) ? entries : []
  const directories = files.filter(file => file.isDirectory).length
  return { total: files.length, directories, files: files.length - directories }
}

export function resolveFileExtensionTagType(extension) {
  if (!extension) return 'info'
  return EXTENSION_TAG_TYPES[getFileTypeNameByExtension(String(extension).toLowerCase())] || 'info'
}

export function formatFileModifiedDate(timestamp) {
  if (!timestamp) return '-'
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return '-'
  const pad = value => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function resolveCurrentFileDirectory(disk, currentPath) {
  return buildFullPath(disk, currentPath)
}

export function resolveFileEntryPath(file, { absolutePath = '', disk = '/', currentPath = '' } = {}) {
  const entryPath = String(file?.path || '')
  if (entryPath.startsWith('/') || /^[A-Za-z]:[\\/]/.test(entryPath)) {
    return formatFilePath(entryPath)
  }
  const basePath = absolutePath || resolveCurrentFileDirectory(disk, currentPath)
  const name = entryPath || String(file?.name || '')
  return formatFilePath(`${basePath}${basePath.endsWith('/') ? '' : '/'}${name}`)
}

export function getFilePreviewMeta(file) {
  return {
    name: String(file?.name || ''),
    size: Number(file?.size ?? 0),
    extension: String(file?.extension || '')
  }
}

export function getFileEntryKey(file) {
  return String(file?.path || `${file?.isDirectory ? 'dir' : 'file'}:${file?.name || ''}`)
}

export async function settleWithConcurrency(items, concurrency, worker) {
  const values = Array.isArray(items) ? items : []
  const limit = Math.max(1, Math.min(values.length || 1, Math.floor(Number(concurrency) || 1)))
  const results = new Array(values.length)
  let cursor = 0

  async function runWorker() {
    while (cursor < values.length) {
      const index = cursor++
      try {
        results[index] = { status: 'fulfilled', value: await worker(values[index], index) }
      } catch (reason) {
        results[index] = { status: 'rejected', reason }
      }
    }
  }

  await Promise.all(Array.from({ length: limit }, runWorker))
  return results
}
