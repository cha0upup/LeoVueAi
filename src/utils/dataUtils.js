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
