import { computed, ref } from 'vue'
import { getApplicationInfoApi } from '@/services/api/application.js'
import { formatDate } from '@/utils/format.js'

export function useAppVersion() {
  const info = ref(null)
  const loading = ref(true)
  const version = computed(() => String(info.value?.version || '').trim())
  const versionLabel = computed(() => version.value
    ? (/^v/i.test(version.value) ? version.value : `v${version.value}`)
    : loading.value ? '版本…' : '版本未知')
  const versionTooltip = computed(() => {
    if (loading.value) return '正在读取服务端版本信息'
    if (!info.value) return '版本信息暂未获取，请刷新后重试'
    const time = formatDate(info.value.buildTime)
    return `服务端版本：${version.value || '未记录'}\n构建时间：${time === '-' ? '未记录' : `${time}（本地时间）`}`
  })

  async function loadVersion() {
    loading.value = true
    try {
      const response = await getApplicationInfoApi()
      const data = response?.data
      info.value = data && typeof data === 'object' && !Array.isArray(data) ? data : null
    } catch {
      // Version metadata is optional and must not interrupt the workspace.
      info.value = null
    } finally {
      loading.value = false
    }
  }

  return { versionLabel, versionTooltip, loadVersion }
}
