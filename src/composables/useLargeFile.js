import { ref, toRaw } from 'vue'
import { previewFileChunkApi } from '@/services/api.js'
import { formatFileSize } from '@/utils/format.js'
import { createBase64StreamDecoder } from './useFileEncoding.js'

const CHUNK_SIZE = 256 * 1024 // 256KB per chunk

/**
 * 大文件懒加载逻辑：分片请求、滚动监听、追加内容
 */
export function useLargeFile({ currentEncoding, onChunkError }) {
  const isLargeFileMode = ref(false)
  const totalFileSize = ref(0)
  const loadedOffset = ref(0)
  const isLoadingChunk = ref(false)
  const scrollDisposer = ref(null)
  let loadGeneration = 0
  let decodeChunk = null

  const resolveNextOffset = (payload, fallbackOffset) => {
    const nextOffset = Number(payload?.nextOffset)
    if (!Number.isFinite(nextOffset) || nextOffset <= fallbackOffset) {
      throw new Error('文件分片偏移未推进')
    }
    return nextOffset
  }

  /**
   * 加载下一个分片并追加到编辑器
   */
  const loadNextChunk = async (sessionId, filePath, getEditorFn) => {
    if (isLoadingChunk.value || loadedOffset.value >= totalFileSize.value) return

    const generation = loadGeneration
    isLoadingChunk.value = true
    try {
      const response = await previewFileChunkApi({
        sessionId,
        path: filePath,
        offset: loadedOffset.value,
        size: CHUNK_SIZE
      })
      if (generation !== loadGeneration) return

      const result = response.data
      if (!result || !result.data) {
        throw new Error('文件内容提前结束，请刷新后重试')
      }

      const nextOffset = resolveNextOffset(result, loadedOffset.value)
      const editor = getEditorFn()
      const model = editor && toRaw(editor).getModel()
      if (!model) return
      const chunkText = decodeChunk(result.data, nextOffset >= totalFileSize.value)

      // 追加到编辑器内容
      const lastLine = model.getLineCount()
      const lastCol = model.getLineMaxColumn(lastLine)
      model.applyEdits([
        {
          range: {
            startLineNumber: lastLine,
            startColumn: lastCol,
            endLineNumber: lastLine,
            endColumn: lastCol
          },
          text: chunkText
        }
      ])

      loadedOffset.value = nextOffset
      if (loadedOffset.value >= totalFileSize.value) {
        loadedOffset.value = totalFileSize.value
      }
    } catch (error) {
      if (generation === loadGeneration) onChunkError?.(error)
    } finally {
      if (generation === loadGeneration) isLoadingChunk.value = false
    }
  }

  /**
   * 监听 Monaco 编辑器滚动，接近底部时自动加载下一个分片
   */
  const setupScrollListener = (getEditorFn, sessionId, filePath) => {
    if (scrollDisposer.value) {
      scrollDisposer.value.dispose()
      scrollDisposer.value = null
    }
    const editor = getEditorFn()
    if (!editor) return

    const rawEditor = toRaw(editor)
    const generation = loadGeneration
    scrollDisposer.value = rawEditor.onDidScrollChange(async () => {
      if (generation !== loadGeneration) return
      if (isLoadingChunk.value) return
      if (loadedOffset.value >= totalFileSize.value) return

      // 当滚动到距离底部 20% 区域时触发加载
      const scrollHeight = rawEditor.getScrollHeight()
      const scrollTop = rawEditor.getScrollTop()
      const clientHeight = rawEditor.getLayoutInfo().height
      const scrollRatio = (scrollTop + clientHeight) / scrollHeight

      if (scrollRatio > 0.8) {
        await loadNextChunk(sessionId, filePath, getEditorFn)
      }
    })
  }

  /**
   * 初始化大文件模式
   * @param {Object} responseData - 首次 preview 返回的 {data, size, truncated}
   * @returns {string} 解码后的首片文本内容
   */
  const initLargeFileMode = (responseData) => {
    loadGeneration += 1
    decodeChunk = createBase64StreamDecoder(currentEncoding.value)
    isLargeFileMode.value = true

    const chunkBase64 = responseData?.data
    totalFileSize.value = responseData?.size || 0
    if (!chunkBase64) throw new Error('后端返回数据为空')

    loadedOffset.value = resolveNextOffset(responseData, 0)
    return decodeChunk(chunkBase64, loadedOffset.value >= totalFileSize.value)
  }

  const resetLargeFile = () => {
    loadGeneration += 1
    decodeChunk = null
    if (scrollDisposer.value) {
      scrollDisposer.value.dispose()
      scrollDisposer.value = null
    }
    isLargeFileMode.value = false
    totalFileSize.value = 0
    loadedOffset.value = 0
    isLoadingChunk.value = false
  }

  return {
    isLargeFileMode,
    totalFileSize,
    loadedOffset,
    isLoadingChunk,
    initLargeFileMode,
    setupScrollListener,
    loadNextChunk,
    resetLargeFile,
    formatFileSize,
    CHUNK_SIZE
  }
}
