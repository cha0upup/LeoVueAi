/**
 * 文件大小格式化（统一实现）
 * @param {number|string} bytes - 文件大小（字节）
 * @returns {string} 格式化后的大小字符串
 */
export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B'

  try {
    const numSize = Number(bytes)
    if (isNaN(numSize) || numSize < 0) return '0 B'

    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(numSize) / Math.log(k))

    return parseFloat((numSize / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  } catch {
    return '0 B'
  }
}

/**
 * 日期时间格式化（完整格式：YYYY-MM-DD HH:mm:ss）
 * @param {number|string|Date} timestamp - 时间戳或日期对象
 * @returns {string} 格式化后的日期时间字符串
 */
export function formatDate(timestamp) {
  if (!timestamp) return '-'

  try {
    const date = new Date(timestamp)
    if (isNaN(date.getTime())) return '-'

    const pad = (n) => String(n).padStart(2, '0')
    const datePart = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    const timePart = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    return `${datePart} ${timePart}`
  } catch {
    return '-'
  }
}

export function formatFilePath(filePath) {
  if (typeof filePath !== 'string') {
    throw new Error('文件路径必须是字符串')
  }

  const isUncPath = /^(?:\\\\|\/\/)/.test(filePath)
  let formattedPath = filePath
    .replace(/\\/g, '/')
    .replace(/^([a-zA-Z]:)(?![/])/, '$1/')
    .replace(/\/+/g, '/')

  // UNC 路径保留双斜杠前缀，根目录保留结尾斜杠。
  if (isUncPath) formattedPath = `/${formattedPath}`
  if (!/^[a-zA-Z]:\/$/.test(formattedPath) && formattedPath !== '/' && formattedPath.endsWith('/')) {
    formattedPath = formattedPath.slice(0, -1)
  }

  return formattedPath.replace('/./', '/')
}

/** 规范化目录路径，保留 POSIX 与 Windows 盘符根目录。 */
export function normalizeDirectoryPath(path) {
  const formatted = formatFilePath(path || '/').replace(/\/\.$/, '')
  if (formatted === '/' || /^[A-Za-z]:\/?$/.test(formatted)) {
    return formatted.endsWith('/') ? formatted : `${formatted}/`
  }
  return formatted.replace(/\/+$/, '')
}

/** 按现有文件路径规则拼接目录与名称。 */
export function joinFilePath(basePath, name) {
  const base = normalizeDirectoryPath(basePath)
  return formatFilePath(`${base}${base.endsWith('/') ? '' : '/'}${name}`)
}
