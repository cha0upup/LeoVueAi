/**
 * useFileSystem - 文件系统检测 composable
 *
 * 提供磁盘/文件系统检测功能，包括：
 * - 磁盘列表加载
 * - Windows/Linux 系统检测
 * - 磁盘切换
 */

import { ref } from 'vue'
import { getFileSystemProfileApi } from '@/services/api/agent-files.js'
import { executeRequest } from '@/utils/apiUtils.js'
import { isWindowsDisk, extractDriveName } from './useFilePath.js'

/**
 * useFileSystem composable
 * @param {Object} options - 配置选项
 * @param {string} options.sessionId - 会话ID
 * @returns {Object} 文件系统相关的方法和状态
 */
export function useFileSystem(options = {}) {
  const { sessionId } = options

  // 状态
  const diskList = ref([])
  const selectedDisk = ref('')
  const isWindows = ref(false)
  const fileSystemProfile = ref(null)
  const isLoading = ref(false)

  /**
   * 从文件列表构建磁盘列表
   * @param {Array} roots - 文件系统根路径列表
   * @returns {Array<{label: string, value: string}>} 磁盘列表
   */
  const buildDiskList = (roots) => {
    return roots
      .filter(isWindowsDisk)
      .map((root) => {
        const driveName = extractDriveName(String(root || ''))
        return { label: driveName, value: driveName }
      })
      .sort((a, b) => a.value.localeCompare(b.value))
  }

  /**
   * 加载磁盘列表
   */
  const loadDisks = async () => {
    try {
      await executeRequest(
        async () => {
          const resp = await getFileSystemProfileApi({ sessionId })
          const profile = resp.data || {}
          const roots = Array.isArray(profile.roots) ? profile.roots : []
          fileSystemProfile.value = profile
          isWindows.value = profile.osFamily === 'WINDOWS'

          diskList.value = isWindows.value ? buildDiskList(roots) : []
          if (!isWindows.value) {
            selectedDisk.value = ''
          } else if (!selectedDisk.value && diskList.value.length) {
            selectedDisk.value = diskList.value[0].value
          }
        },
        {
          loadingRef: isLoading,
          successMessage: null,
          errorMessage: '获取磁盘列表失败'
        }
      )
    } catch { /* ignore */ }
  }

  return {
    // 状态
    diskList,
    selectedDisk,
    isWindows,
    fileSystemProfile,
    isLoading,

    // 方法
    loadDisks
  }
}
