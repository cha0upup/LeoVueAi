import { getDisguisesApi } from '@/services/api.js'

import { showError } from './messageUtils.js'

/**
 * 获取所有 Disguise 列表（包含 ID 和名称）
 * @returns {Promise<Array>} Disguise 列表，每个元素包含 disguiseId 和 disguiseName
 */
export async function getAllDisguises() {
  try {
    const response = await getDisguisesApi()
    return response.data || []
  } catch {
    showError('获取伪装列表失败')
    return []
  }
}
