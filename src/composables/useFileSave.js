import { ref } from 'vue'
import { editFileApi } from '@/services/api.js'
import { showError, showSuccess } from '@/utils/messageUtils.js'
import { normalizeFileLineEndings } from '@/components/PuppetConsole/File/filePreviewModel.js'
import { encodeFileText } from './useFileEncoding.js'

// 调用方提供编辑快照并更新保存基线；此处负责请求生命周期。
export function useFileSave({ getSnapshot, onSaved }) {
  const isSaving = ref(false)
  let generation = 0

  const reset = () => {
    generation += 1
    isSaving.value = false
  }

  const save = async () => {
    if (isSaving.value) return
    const snapshot = getSnapshot()
    if (!snapshot) return
    const { sessionId, filePath, content, lineEnding, encoding } = snapshot
    const sequence = ++generation
    const isCurrent = () => sequence === generation
    isSaving.value = true
    try {
      await editFileApi({
        sessionId,
        path: filePath,
        content: encodeFileText(normalizeFileLineEndings(content, lineEnding), encoding),
        encoding
      })
      if (!isCurrent()) return

      onSaved(snapshot)
      showSuccess(`文件保存成功 (${encoding.toUpperCase()} / ${lineEnding})`)
    } catch (error) {
      if (isCurrent()) showError(`文件保存失败：${error?.message || '未知错误'}`)
    } finally {
      if (isCurrent()) isSaving.value = false
    }
  }
  return { save, isSaving, reset }
}
