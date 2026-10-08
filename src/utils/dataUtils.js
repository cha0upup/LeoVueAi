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

/** 按字段文本原地排序；调用方传入列表副本。 */
export function sortRowsByText(rows, { prop, order }) {
  if (!prop || !order) return rows
  rows.sort((a, b) => {
    const va = (a[prop] || '').toString()
    const vb = (b[prop] || '').toString()
    const cmp = va.localeCompare(vb)
    return order === 'ascending' ? cmp : -cmp
  })
  return rows
}
