/**
 * TSV 导出工具
 *
 * 用法一：自动提取列（适合动态 key 场景）
 *   exportTsv(entries.value, 'event-log')
 *
 * 用法二：指定列映射（适合固定字段场景）
 *   exportTsv(rules.value, 'firewall_rules', [
 *     { label: 'Name', key: 'name' },
 *     { label: 'Direction', key: 'direction' },
 *   ])
 *
 * 用法三：指定列映射 + 自定义取值
 *   exportTsv(mounts.value, 'network_mounts', [
 *     { label: 'Local', key: row => row.local || row.mountPoint || '' },
 *   ])
 */

/**
 * @param {Array<Object>} data     要导出的数据行
 * @param {string}        filename 文件名（不含扩展名，自动追加 .tsv）
 * @param {Array<{label:string, key:string|Function}>} [columns]
 *        可选的列定义。省略则自动从 data 提取所有 key。
 *        key 为字符串时取 row[key]；为函数时调用 key(row)。
 */
export function exportTsv(data, filename, columns) {
  if (!data || data.length === 0) return

  let header, rows

  if (columns && columns.length > 0) {
    // 固定列模式
    header = columns.map(c => c.label).join('\t')
    rows = data.map(row =>
      columns.map(c => {
        const val = typeof c.key === 'function' ? c.key(row) : (row[c.key] ?? '')
        return sanitize(val)
      }).join('\t')
    )
  } else {
    // 自动列模式：从数据中收集所有 key
    const keySet = new Set()
    data.forEach(row => Object.keys(row).forEach(k => keySet.add(k)))
    const cols = [...keySet]
    header = cols.join('\t')
    rows = data.map(row =>
      cols.map(k => sanitize(row[k] ?? '')).join('\t')
    )
  }

  const tsv = header + '\n' + rows.join('\n')
  download(tsv, filename)
}

// ────── internal ──────

function sanitize(val) {
  return String(val).replace(/[\t\n\r]/g, ' ')
}

function download(content, filename) {
  const blob = new Blob([content], { type: 'text/tab-separated-values;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.tsv') ? filename : `${filename}.tsv`
  a.click()
  URL.revokeObjectURL(url)
}
