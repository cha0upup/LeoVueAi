import { ref } from 'vue'

const DEFAULT_ENCODING = 'utf-8'

/**
 * 文件编码相关逻辑：检测、转换、Base64 解码
 */
export function useFileEncoding() {
  const currentEncoding = ref(DEFAULT_ENCODING)
  const originalEncoding = ref(DEFAULT_ENCODING)

  const encodingOptions = [
    { value: 'utf-8', label: 'UTF-8' },
    { value: 'utf-8-bom', label: 'UTF-8 BOM' }
  ]

  /**
   * 安全地将 Base64 字符串解码为文本。
   * 处理 URL-safe 字符、空白符、缺失 padding，并通过 TextDecoder 支持多字节编码。
   */
  const decodeBase64ToString = (base64Str, encoding = 'utf-8') => {
    // 1. 清理：去除空白和换行
    let cleaned = base64Str.replace(/[\s\r\n]+/g, '')
    // 2. URL-safe → 标准 Base64
    cleaned = cleaned.replace(/-/g, '+').replace(/_/g, '/')
    // 3. 补齐 padding
    const pad = cleaned.length % 4
    if (pad === 2) cleaned += '=='
    else if (pad === 3) cleaned += '='

    // 4. 解码为二进制字符串 → Uint8Array
    const binaryStr = atob(cleaned)
    const bytes = new Uint8Array(binaryStr.length)
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i)
    }

    // 5. 使用 TextDecoder 按指定编码转换
    const dec = encoding === 'utf-8-bom' ? 'utf-8' : encoding
    return new TextDecoder(dec, { ignoreBOM: true }).decode(bytes)
  }

  /**
   * 简单的编码检测逻辑
   */
  const detectEncoding = (content) => {
    const bytes = new TextEncoder().encode(content)

    // 检测UTF-8 BOM
    if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
      return 'utf-8-bom'
    }

    return 'utf-8'
  }

  /**
   * 编码转换
   */
  const convertEncoding = async (content, fromEncoding, toEncoding) => {
    try {
      if (fromEncoding === toEncoding) {
        return content
      } else if (fromEncoding === 'utf-8' && toEncoding === 'utf-8-bom') {
        return content.startsWith('\uFEFF') ? content : `\uFEFF${content}`
      } else if (fromEncoding === 'utf-8-bom' && toEncoding === 'utf-8') {
        return content.startsWith('\uFEFF') ? content.slice(1) : content
      } else {
        throw new Error(`不支持的写入编码: ${toEncoding}`)
      }
    } catch (error) {
      throw new Error(`编码转换失败：${error.message}`, { cause: error })
    }
  }

  const resetEncoding = () => {
    currentEncoding.value = DEFAULT_ENCODING
    originalEncoding.value = DEFAULT_ENCODING
  }

  return {
    currentEncoding,
    originalEncoding,
    encodingOptions,
    decodeBase64ToString,
    detectEncoding,
    convertEncoding,
    resetEncoding,
    DEFAULT_ENCODING
  }
}
