import { downloadBlob } from './downloadBlob.js'
import { executeRequest } from './apiUtils.js'

/**
 * 执行返回 Blob 的导出请求，并统一处理下载、loading 和错误提示。
 * @param {Function} request 请求函数，返回包含 Blob data 的响应
 * @param {string} filename 下载文件名
 * @param {Object} [options]
 * @param {Object} [options.loadingRef]
 * @param {string|null} [options.successMessage=null]
 * @param {string|null} [options.errorMessage='导出失败']
 * @returns {Promise<Object>}
 */
export function executeBlobDownload(request, filename, options = {}) {
  return executeRequest(
    async () => {
      const response = await request()
      downloadBlob(response.data, filename)
      return response
    },
    {
      errorMessage: '导出失败',
      ...options
    }
  )
}

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

  const exportColumns = columns?.length
    ? columns
    : [...new Set(data.flatMap((row) => Object.keys(row)))].map((key) => ({ label: key, key }))
  const header = exportColumns.map((column) => column.label).join('\t')
  const rows = data.map((row) =>
    exportColumns.map(({ key }) =>
      sanitize(typeof key === 'function' ? key(row) : (row[key] ?? ''))
    ).join('\t')
  )

  const tsv = header + '\n' + rows.join('\n')
  downloadBlob(
    new Blob([tsv], { type: 'text/tab-separated-values;charset=utf-8' }),
    filename.endsWith('.tsv') ? filename : `${filename}.tsv`
  )
}

// ────── internal ──────

function sanitize(val) {
  return String(val).replace(/[\t\n\r]/g, ' ')
}
