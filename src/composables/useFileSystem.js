/**
 * useFileSystem - 文件系统检测 composable
 *
 * 提供磁盘/文件系统检测功能，包括：
 * - 磁盘列表加载
 * - Windows/Linux 系统检测
 * - 磁盘切换
 */

import { ref } from 'vue'
import { getFileSystemProfileApi } from '@/services/api.js'
import { executeRequest } from '@/utils/apiUtils.js'
import {
  isWindowsDisk,
  extractDriveName
} from './useFilePath.js'

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
   * @param {Array} fileList - 文件列表
   * @returns {Array<{label: string, value: string}>} 磁盘列表
   */
  const buildDiskList = (roots) => {
    return roots
      .filter((root) => isWindowsDisk(root))
      .map((root) => {
        const sourcePath = String(root || '')
        const driveName = extractDriveName(sourcePath)
        return {
          label: driveName,
          value: driveName
        }
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

          if (isWindows.value) {
            const newDiskList = buildDiskList(roots)
            diskList.value = newDiskList

            // 如果当前没有选中磁盘，选择第一个
            if (!selectedDisk.value && newDiskList.length > 0) {
              selectedDisk.value = newDiskList[0].value
            }
          } else {
            diskList.value = []
            selectedDisk.value = ''
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
    loadDisks,
    buildDiskList,

    // 工具函数
    isWindowsDisk,
    extractDriveName
  }
}
