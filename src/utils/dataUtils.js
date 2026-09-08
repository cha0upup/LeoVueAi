/**
 * 数据工具函数
 * 提供数据转换、构建和处理的通用方法
 */
/**
 * 从对象中排除指定字段
 * @param {Object} obj - 源对象
 * @param {Array<string>} fields - 要排除的字段列表
 * @returns {Object} 排除指定字段后的新对象
 */
export function omitFields(obj, fields) {
  const result = { ...obj }
  fields.forEach((field) => {
    delete result[field]
  })
  return result
}
