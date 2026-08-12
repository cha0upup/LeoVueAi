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
  // 1. 确保输入是字符串类型
  if (typeof filePath !== 'string') {
    throw new Error('文件路径必须是字符串')
  }

  // 2. 根据操作系统规范化路径分隔符
  // 使用正则替换所有的反斜杠 '\\' 为正斜杠 '/'
  const isUncPath = /^(?:\\\\|\/\/)/.test(filePath)
  let formattedPath = filePath.replace(/\\/g, '/')

  // 2.1 处理 Windows 盘符路径缺少斜杠的情况：例如 "D:IdeaProjects/xxx"
  // 规范化为 "D:/IdeaProjects/xxx"，否则后端在 Windows 上会当成相对路径
  // 匹配形如 "D:后面不是 /" 的开头
  if (/^[a-zA-Z]:(?![/])/.test(formattedPath)) {
    formattedPath = formattedPath.replace(/^([a-zA-Z]:)(?![/])/, '$1/')
  }

  // 3. 删除多余的斜杠 (例如 '//', '///' 等)
  // 这将处理像 "/folder//subfolder///file.txt" 这样的路径
  formattedPath = isUncPath
    ? `//${formattedPath.replace(/^\/+/, '').replace(/\/+/g, '/')}`
    : formattedPath.replace(/\/+/g, '/')

  // 4. 检查是否是 Windows 盘符根目录（如 D:/）
  const isWindowsDriveRoot = /^[a-zA-Z]:\/$/.test(formattedPath)

  // 5. 去除路径结尾的多余斜杠（除了根目录和 Windows 盘符根目录）
  if (!isWindowsDriveRoot && formattedPath !== '/' && formattedPath.endsWith('/')) {
    formattedPath = formattedPath.slice(0, -1)
  }

  // 6. 处理 './' 路径：保留开头的 './' 或 '.'，移除路径中间的 './'
  if (formattedPath === './' || formattedPath === '.') {
    return '.'
  }
  // 移除路径中间的 './' 模式
  formattedPath = formattedPath.replace('/./', '/')

  return formattedPath
}
