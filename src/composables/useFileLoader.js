import { ref } from 'vue'
import { previewFileApi } from '@/services/api.js'
import { showError, showWarning } from '@/utils/messageUtils.js'

// 图片扩展名
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp']
// PDF 扩展名
const PDF_EXTENSIONS = ['pdf']

// 代码语言映射
const LANGUAGE_MAP = {
  js: 'javascript',
  java: 'java',
  html: 'html',
  css: 'css',
  py: 'python',
  sh: 'shell',
  md: 'markdown',
  rb: 'ruby',
  sql: 'sql',
  bat: 'bat',
  json: 'json',
  jsp: 'java',
  jspx: 'xml',
  xml: 'xml',
  vue: 'vue',
  ts: 'typescript',
  jsx: 'javascript',
  tsx: 'typescript',
  go: 'go',
  rs: 'rust',
  cpp: 'cpp',
  c: 'c',
  h: 'c',
  hpp: 'cpp',
  cs: 'csharp',
  swift: 'swift',
  kt: 'kotlin',
  scala: 'scala',
  r: 'r',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'toml',
  ini: 'ini',
  conf: 'ini',
  log: 'log',
  txt: 'plaintext'
}

/**
 * 文件加载与类型检测逻辑
 */
export function useFileLoader({ decodeBase64ToString, detectEncoding, currentEncoding, originalEncoding }) {
  const fileContent = ref('')
  const fileType = ref('text')
  const codeLanguage = ref('plaintext')
  const originalContent = ref('')
  const isModified = ref(false)
  let loadGeneration = 0

  const isZeroSizePreview = (payload, fallbackMeta = {}) => {
    const rawSize = payload?.size ?? fallbackMeta?.size
    const size = Number(rawSize)
    return Number.isFinite(size) && size === 0
  }

  const resolvePreviewData = (payload, fallbackMeta = {}) => {
    const fileData = payload?.data
    if (fileData === null || fileData === undefined) {
      if (isZeroSizePreview(payload, fallbackMeta)) {
        return ''
      }
      showError('后端返回数据为空')
      return null
    }
    return String(fileData)
  }

  const getFileExtension = (path) => {
    return path?.split('.').pop()?.toLowerCase() || ''
  }

  const setFileType = (filePath) => {
    const extension = getFileExtension(filePath)
    if (!extension) {
      fileType.value = 'text'
      return
    }

    if (IMAGE_EXTENSIONS.includes(extension)) {
      fileType.value = 'image'
    } else if (PDF_EXTENSIONS.includes(extension)) {
      fileType.value = 'pdf'
    } else {
      codeLanguage.value = LANGUAGE_MAP[extension] || 'plaintext'
      fileType.value = 'text'
    }
  }

  /**
   * 加载文件预览（普通模式）
   * @returns {{ truncated: boolean, responseData: Object }|null}
   */
  const loadFile = async (sessionId, filePath, fileMeta = {}) => {
    const generation = ++loadGeneration
    let response
    try {
      response = await previewFileApi({
        sessionId,
        path: filePath,
        encoding: currentEncoding.value
      })
    } catch (error) {
      if (generation !== loadGeneration) return null
      throw error
    }
    if (generation !== loadGeneration) return null

    const responseData = {
      ...fileMeta,
      ...(response.data || {})
    }

    if (responseData.truncated) {
      return { truncated: true, responseData }
    }

    const fileData = resolvePreviewData(responseData, fileMeta)
    if (fileData === null) {
      return null
    }

    setFileType(filePath)

    if (fileType.value === 'image') {
      fileContent.value = `data:image/${getFileExtension(filePath)};base64,${fileData}`
    } else if (fileType.value === 'pdf') {
      fileContent.value = `data:application/pdf;base64,${fileData}`
    } else {
      fileContent.value = decodeBase64ToString(fileData, currentEncoding.value)
      originalContent.value = fileContent.value
      isModified.value = false

      // 检测文件编码
      const detectedEnc = detectEncoding(fileContent.value)
      currentEncoding.value = detectedEnc
      originalEncoding.value = detectedEnc
    }

    return { truncated: false, responseData }
  }

  /**
   * 以指定编码重新加载文件
   */
  const reloadWithEncoding = async (sessionId, filePath, fileMeta = {}) => {
    const generation = ++loadGeneration
    let response
    try {
      response = await previewFileApi({
        sessionId,
        path: filePath,
        encoding: currentEncoding.value
      })
    } catch (error) {
      if (generation !== loadGeneration) return null
      throw error
    }
    if (generation !== loadGeneration) return null

    const responseData = {
      ...fileMeta,
      ...(response.data || {})
    }

    if (responseData.truncated) {
      showError('文件过大，仅支持预览1MB以下内容')
      return null
    }

    const fileData = resolvePreviewData(responseData, fileMeta)
    if (fileData === null) {
      return null
    }

    if (fileType.value === 'image') {
      fileContent.value = `data:image/${getFileExtension(filePath)};base64,${fileData}`
    } else {
      let decodedContent
      try {
        decodedContent = decodeBase64ToString(fileData, currentEncoding.value)
      } catch {
        decodedContent = decodeBase64ToString(fileData, 'utf-8')
        showWarning('编码解析失败，已回退到UTF-8')
      }

      fileContent.value = decodedContent
      originalContent.value = decodedContent
      isModified.value = false
    }
    return responseData
  }

  const resetFileState = () => {
    loadGeneration += 1
    fileContent.value = ''
    fileType.value = 'text'
    codeLanguage.value = 'plaintext'
    originalContent.value = ''
    isModified.value = false
  }

  return {
    fileContent,
    fileType,
    codeLanguage,
    originalContent,
    isModified,
    getFileExtension,
    setFileType,
    loadFile,
    reloadWithEncoding,
    resetFileState
  }
}
