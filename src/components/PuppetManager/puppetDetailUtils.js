import { ElMessage } from 'element-plus'
import { icons } from '@/utils/icons.js'

export const isChildHost = (row) => row?.parentPuppetId && row.parentPuppetId !== 'root'

export const getHostIcon = (row) => (isChildHost(row) ? icons.connection : icons.server)

export const isPuppetQuickSaving = (puppet, quickSavingKey, field) =>
  Boolean(puppet?.puppetId && quickSavingKey === `${puppet.puppetId}:${field}`)

export const getHostDisplayName = (puppet) => {
  const name = String(puppet?.puppetName || '').trim()
  const link = String(puppet?.connLink || '').trim()
  if (name && name !== link) return name
  try {
    return new URL(link).host || name || '未命名主机'
  } catch {
    return name || link || '未命名主机'
  }
}

export const copyHostDetail = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制')
  } catch {
    ElMessage.warning('复制失败，请选择文本手动复制')
  }
}
