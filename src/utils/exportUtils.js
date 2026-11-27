import { downloadBlob } from './downloadBlob.js'
import { executeRequest } from './apiUtils.js'
import { handleError } from './errorHandler.js'
import { isCurrentSession, sessionGeneration } from '@/services/sessionLifecycle.js'

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

// 导出开始时固定选中项；下载成功后仅移除本次导出的选择。
export async function exportSelectedArchive(selectedIds, request, filenamePrefix, itemName, loadingRef) {
  const ids = Array.from(selectedIds.value)
  if (!ids.length) return
  const date = new Date().toISOString().slice(0, 10)
  await executeBlobDownload(() => request(ids), `${filenamePrefix}_${date}.zip`, {
    loadingRef,
    successMessage: `已导出 ${ids.length} ${itemName}`,
    onSuccess: () => {
      for (const id of ids) selectedIds.value.delete(id)
    }
  }).catch(() => false)
}

/**
 * 导出单工作表。未指定列时，按字段首次出现的顺序生成表头。
 * @param {Array<Object>} data
 * @param {string} filename 文件名，可省略 .xlsx 后缀。
 * @param {Array<{label:string, key:string|Function}>} [columns]
 * @param {Function} [shouldDownload] 工作簿加载完成后判断本次导出是否仍有效。
 */
export async function exportXlsx(data, filename, columns, shouldDownload) {
  if (!data?.length) return false

  try {
    const exportColumns = columns?.length
      ? columns
      : [...new Set(data.flatMap(row => Object.keys(row)))].map(key => ({ label: key, key }))
    const rows = [exportColumns.map(({ label }) => label)]
    for (const row of data) {
      rows.push(exportColumns.map(({ key }) => typeof key === 'function' ? key(row) : row[key]))
    }
    return await writeWorkbookSpec({ fileName: filename, sheets: [{ name: '数据', rows }] }, shouldDownload)
  } catch (error) {
    handleError(error, { defaultMessage: '导出失败' })
    return false
  }
}

/** 导出已有工作表结构，供容器等多工作表导出复用。 */
export async function writeWorkbookSpec({ fileName, sheets }, shouldDownload = () => true) {
  const generation = sessionGeneration.value
  const isActive = () => isCurrentSession(generation) && shouldDownload()
  try {
    const module = await import('xlsx')
    if (!isActive()) return false
    const xlsx = module.default || module
    const workbook = xlsx.utils.book_new()
    for (const { name, rows } of sheets) {
      if (rows.length > 1_048_576 || rows.some(row => row.length > 16_384)) {
        throw new RangeError('导出范围超过 XLSX 单工作表上限，请缩小筛选范围')
      }
      const sheet = xlsx.utils.aoa_to_sheet(rows.map(row => row.map(workbookCell)))
      xlsx.utils.book_append_sheet(workbook, sheet, name)
    }
    const bytes = xlsx.write(workbook, { bookType: 'xlsx', type: 'array' })
    downloadBlob(new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }), /\.xlsx$/i.test(fileName) ? fileName : `${fileName}.xlsx`)
    return true
  } catch (error) {
    if (!isActive()) return false
    throw error
  }
}

function workbookCell(value) {
  if (value == null) return null
  // 只传普通值，避免 xlsx 将任意对象当成单元格定义。
  if (typeof value === 'number' || typeof value === 'boolean') return value
  return String(value)
}
