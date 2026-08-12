/**
 * 文件操作验证规则
 * 包含文件名、路径等验证逻辑
 */

// 文件名正则：禁止 \ / : * ? " < > | 特殊字符
export const FILE_NAME_PATTERN = /^[^\\/:*?"<>|]+$/
export const FILE_NAME_ERROR_MESSAGE = '文件名不能包含特殊字符 \\ / : * ? " < > |'
const PATH_INPUT_ERROR_MESSAGE =
  '路径格式不正确，Windows路径应以盘符开头（如C:\\），Linux路径应以/开头'

/**
 * 验证目录路径格式
 * @param {Object} rule - 验证规则
 * @param {string} value - 路径值
 * @param {Function} callback - 回调函数
 */
export function validateDirectoryPath(rule, value, callback) {
  if (value && value.trim() && !/^[a-zA-Z]:/.test(value) && !value.startsWith('/')) {
    callback(new Error(PATH_INPUT_ERROR_MESSAGE))
    return
  }
  callback()
}

/**
 * 验证文件名格式
 * @param {Object} rule - 验证规则
 * @param {string} value - 文件名值
 * @param {Function} callback - 回调函数
 */
export function validateFileName(rule, value, callback) {
  if (value && value.trim() && !FILE_NAME_PATTERN.test(value)) {
    callback(new Error(FILE_NAME_ERROR_MESSAGE))
    return
  }
  callback()
}
