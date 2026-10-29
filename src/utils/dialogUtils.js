/**
 * 对话框工具函数
 * 提供统一的对话框状态管理
 */

import { ref } from 'vue'

/**
 * 创建对话框状态管理
 * @returns {Object} 包含visible、open、close方法的对象
 */
export function useDialog() {
  const visible = ref(false)

  return {
    visible,
    open: () => { visible.value = true },
    close: () => { visible.value = false }
  }
}

/**
 * 创建编辑对话框状态管理（包含当前编辑项）
 * @returns {Object} 包含visible、currentItem、open、close方法的对象
 */
export function useEditDialog() {
  const visible = ref(false)
  const currentItem = ref(null)

  const open = (item = null) => {
    currentItem.value = item
    visible.value = true
  }

  const close = () => {
    visible.value = false
    currentItem.value = null
  }

  return {
    visible,
    currentItem,
    open,
    close
  }
}
