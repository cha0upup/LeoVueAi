/**
 * 对话框工具函数
 * 提供统一的对话框状态管理
 */

import { ref } from 'vue'

/**
 * 创建对话框状态管理
 * @param {boolean} initialValue - 初始状态，默认false
 * @returns {Object} 包含visible、open、close、toggle方法的对象
 */
export function useDialog(initialValue = false) {
  const visible = ref(initialValue)

  const open = () => {
    visible.value = true
  }

  const close = () => {
    visible.value = false
  }

  const toggle = () => {
    visible.value = !visible.value
  }

  return {
    visible,
    open,
    close,
    toggle
  }
}

/**
 * 创建多个对话框状态管理
 * @param {Array<string>} dialogNames - 对话框名称数组
 * @returns {Object} 包含所有对话框状态的对象
 */
export function useDialogs(dialogNames) {
  const dialogs = {}

  dialogNames.forEach((name) => {
    dialogs[name] = useDialog()
  })

  return dialogs
}

/**
 * 创建编辑对话框状态管理（包含当前编辑项）
 * @param {*} initialItem - 初始编辑项，默认null
 * @returns {Object} 包含visible、currentItem、open、close、reset方法的对象
 */
export function useEditDialog(initialItem = null) {
  const visible = ref(false)
  const currentItem = ref(initialItem)

  const open = (item = null) => {
    currentItem.value = item
    visible.value = true
  }

  const close = () => {
    visible.value = false
    currentItem.value = initialItem
  }

  const reset = () => {
    currentItem.value = initialItem
  }

  return {
    visible,
    currentItem,
    open,
    close,
    reset
  }
}
