import { ref, toRaw } from 'vue'
import { previewFileChunkApi } from '@/services/api.js'
import { formatFileSize } from '@/utils/format.js'

const CHUNK_SIZE = 256 * 1024 // 256KB per chunk

/**
 * 大文件懒加载逻辑：分片请求、滚动监听、追加内容
 */
export function useLargeFile({ decodeBase64ToString, currentEncoding, onChunkError }) {
  const isLargeFileMode = ref(false)
  const totalFileSize = ref(0)
  const loadedOffset = ref(0)
  const isLoadingChunk = ref(false)
  const scrollDisposer = ref(null)
  let loadGeneration = 0

  const resolveNextOffset = (payload, fallbackOffset, fallbackSize) => {
    const nextOffset = Number(payload?.nextOffset)
    if (Number.isFinite(nextOffset) && nextOffset >= fallbackOffset) {
      return nextOffset
    }

    const bytesRead = Number(payload?.bytesRead)
    if (Number.isFinite(bytesRead) && bytesRead >= 0) {
      return fallbackOffset + bytesRead
    }

    return fallbackOffset + fallbackSize
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
        // 没有更多数据
        loadedOffset.value = totalFileSize.value
        return
      }

      const chunkText = decodeBase64ToString(result.data, currentEncoding.value)
      if (!chunkText) return

      // 追加到编辑器内容
      const editor = getEditorFn()
      if (editor) {
        const rawEditor = toRaw(editor)
        const model = rawEditor.getModel()
        if (model) {
          const lastLine = model.getLineCount()
          const lastCol = model.getLineMaxColumn(lastLine)
          model.applyEdits([{
            range: {
              startLineNumber: lastLine,
              startColumn: lastCol,
              endLineNumber: lastLine,
              endColumn: lastCol
            },
            text: chunkText
          }])
        }
      }

      loadedOffset.value = resolveNextOffset(result, loadedOffset.value, CHUNK_SIZE)
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
   * @param {string} sessionId
   * @param {string} filePath
   * @returns {string} 解码后的首片文本内容
   */
  const initLargeFileMode = async (responseData, sessionId, filePath) => {
    const generation = ++loadGeneration
    isLargeFileMode.value = true

    const chunkBase64 = responseData?.data
    totalFileSize.value = responseData?.size || 0

    if (!chunkBase64) {
      // 首次响应没有数据，用 preview-chunk 重新请求
      const response = await previewFileChunkApi({
        sessionId,
        path: filePath,
        offset: 0,
        size: CHUNK_SIZE
      })
      if (generation !== loadGeneration) return null
      const result = response.data
      if (!result || !result.data) {
        throw new Error('后端返回数据为空')
      }
      totalFileSize.value = result.size || 0
      const text = decodeBase64ToString(result.data, currentEncoding.value)
      loadedOffset.value = resolveNextOffset(result, 0, CHUNK_SIZE)
      return text
    } else {
      const text = decodeBase64ToString(chunkBase64, currentEncoding.value)
      loadedOffset.value = resolveNextOffset(responseData, 0, 1024 * 1024)
      return text
    }
  }

  const resetLargeFile = () => {
    loadGeneration += 1
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
