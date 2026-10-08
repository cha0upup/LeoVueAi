/**
 * useFilePath - 文件路径处理 composable
 *
 * 提供跨平台（Windows/Linux）的路径处理逻辑，包括：
 * - Windows/Linux 路径检测
 * - 盘符提取和处理
 * - 路径规范化
 * - 面包屑导航构建
 */

import { computed } from 'vue'
import { formatFilePath } from '@/utils/format.js'

// Windows 盘符正则表达式
const WINDOWS_DISK_REGEX = /^[A-Za-z]:[\\/]*$/

/**
 * 检查是否为 Windows 盘符路径
 * @param {string} text - 要检查的文本
 * @returns {boolean}
 */
export function isWindowsDisk(text) {
  return WINDOWS_DISK_REGEX.test(text || '')
}

/**
 * 从文本中提取盘符名称（如 "C:"）
 * @param {string} text - 源文本
 * @returns {string} 盘符名称，如 "C:"
 */
export function extractDriveName(text) {
  const matchResult = (text || '').match(/^([A-Za-z]):/)
  return matchResult ? `${matchResult[1]}:` : ''
}

/**
 * 判断路径是否为 Windows 路径
 * @param {string} path - 路径
 * @returns {boolean}
 */
function isWindowsPath(path) {
  return path?.includes(':') || /^[A-Za-z]:/.test(path || '') || /^(?:\\\\|\/\/)/.test(path || '')
}

/**
 * 规范化路径（确保以分隔符结尾，用于树形组件）
 * @param {string} path - 原始路径
 * @returns {string} 规范化后的路径
 */
export function normalizePathForTree(path) {
  if (!path) return ''

  // 统一盘符大小写；所有路径共用尾部分隔符处理。
  let normalized = formatFilePath(path)
  const driveMatch = normalized.match(/^([A-Za-z]):(.*)$/)
  if (driveMatch) normalized = `${driveMatch[1].toUpperCase()}:${driveMatch[2]}`
  return normalized.endsWith('/') ? normalized : `${normalized}/`
}

/**
 * 构建子节点路径
 * @param {string} parentPath - 父路径
 * @param {string} childName - 子节点名称
 * @returns {string} 完整路径
 */
export function buildChildPath(parentPath, childName) {
  const normalizedParent = normalizePathForTree(parentPath)
  const parentWithoutSlash = normalizedParent.replace(/\/$/, '')
  return normalizePathForTree(`${parentWithoutSlash}/${childName}`)
}

/**
 * 构建完整路径
 * @param {string} disk - 磁盘/根标识（Windows为盘符如"C:"，Linux为"/"）
 * @param {string} relativePath - 相对路径
 * @returns {string} 完整路径
 */
export function buildFullPath(disk, relativePath = '') {
  const root = disk?.includes(':') || /^\/\//.test(disk || '') ? disk : ''
  return formatFilePath(`${root}/${relativePath || ''}`)
}

/**
 * 从完整路径提取磁盘和相对路径
 * @param {string} absolutePath - 完整路径
 * @returns {{ disk: string, relativePath: string }} 磁盘和相对路径
 */
export function parseAbsolutePath(absolutePath) {
  if (!absolutePath) {
    return { disk: '/', relativePath: '' }
  }

  const formattedPath = formatFilePath(absolutePath)

  if (formattedPath.startsWith('//')) {
    const segments = formattedPath.slice(2).split('/').filter(Boolean)
    if (segments.length >= 2) {
      return {
        disk: `//${segments[0]}/${segments[1]}`,
        relativePath: segments.slice(2).join('/')
      }
    }
  }

  const driveMatchResult = formattedPath.match(/^([A-Za-z]:)(.*)$/)
  if (driveMatchResult) {
    const [, driveLetter, pathRest] = driveMatchResult
    return {
      disk: driveLetter,
      relativePath: pathRest.replace(/^\/+/, '')
    }
  }

  // Linux 路径
  return {
    disk: '/',
    relativePath: formattedPath.replace(/^\/+/, '')
  }
}

/**
 * useFilePath composable
 * @param {Object} options - 配置选项
 * @param {Ref<string>} options.disk - 当前磁盘
 * @param {Ref<string>} options.currentPath - 当前相对路径
 * @returns {Object} 文件路径相关的方法和计算属性
 */
export function useFilePath(options = {}) {
  const { disk, currentPath } = options

  /**
   * 构建面包屑导航数据
   * @returns {Array<{text: string, link: string}>} 面包屑数组
   */
  const breadcrumbs = computed(() => {
    const isWindowsRoot = (disk?.value?.includes(':') ?? false) || /^\/\//.test(disk?.value || '')
    const rootText = isWindowsRoot ? disk?.value : '/'
    const crumbs = [{ text: rootText, link: buildFullPath(disk?.value) }]
    const pathParts = (currentPath?.value || '').split('/').filter(Boolean)
    pathParts.forEach((part, index) => {
      crumbs.push({
        text: part,
        link: buildFullPath(disk?.value, pathParts.slice(0, index + 1).join('/'))
      })
    })

    return crumbs
  })

  /**
   * 计算当前完整路径
   */
  const currentFullPath = computed(() => buildFullPath(disk?.value, currentPath?.value))

  /**
   * 判断是否可以返回上一级
   */
  const canGoBack = computed(() => Boolean(currentPath?.value))

  return {
    // 常量
    WINDOWS_DISK_REGEX,

    // 工具函数
    isWindowsDisk,
    extractDriveName,
    isWindowsPath,
    normalizePathForTree,
    buildChildPath,
    buildFullPath,
    parseAbsolutePath,

    // 计算属性
    breadcrumbs,
    currentFullPath,
    canGoBack
  }
}
