import { computed, ref } from 'vue'
import { mapPersistedMessages } from './aiHistoryModel.js'
import { ARTIFACT_CATEGORY, archiveTextArtifact, buildAiReportMarkdown } from '@/utils/artifactArchive.js'
import { showError, showSuccess } from '@/utils/messageUtils.js'

/** 共用完整报告归档流程；视图只负责提供当前会话信息。 */
export function useAiReportArchive({ sourceModule, messages, isBusy, getContext, loadMessages }) {
  const nodeScoped = sourceModule === 'node-ai'
  const label = nodeScoped ? '节点' : '平台'
  const archivingReport = ref(false)
  const canArchiveReport = computed(() => !isBusy() &&
    messages.value.some(message => message?.role === 'assistant'))

  const archiveCurrentReport = async () => {
    if (!canArchiveReport.value || archivingReport.value) return
    archivingReport.value = true
    try {
      // 在首次 await 前固定上下文，切换线程不会改变正在生成的报告归属。
      const context = { ...getContext() }
      const title = context.title || `${label} AI 分析`
      const history = await loadMessages(context.threadId)
      const reportMessages = mapPersistedMessages(history, { includeSubtasks: !nodeScoped })
      const artifact = await archiveTextArtifact({
        category: ARTIFACT_CATEGORY.AI_REPORTS,
        name: nodeScoped ? `${label}-${context.hostName}-${title}` : `${label}-${title}`,
        metadata: { title, sourceModule, sourceId: context.threadId,
          ...(nodeScoped ? { sessionId: context.sessionId, hostName: context.hostName } : {}) },
        extension: 'md',
        content: buildAiReportMarkdown({
          ...context, title, scope: `${label} AI 分析`, historyScope: 'full', messages: reportMessages
        })
      })
      showSuccess('分析报告已归档到成果库')
      return artifact
    } catch (error) {
      showError('归档分析报告失败：' + (error?.message || '未知错误'))
    } finally {
      archivingReport.value = false
    }
  }

  return { archivingReport, canArchiveReport, archiveCurrentReport }
}
