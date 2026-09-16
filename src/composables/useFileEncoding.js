import { ref } from 'vue'

const DEFAULT_ENCODING = 'utf-8'

function decodeBase64Bytes(value) {
  const normalized = value.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

export function createBase64StreamDecoder(encoding = DEFAULT_ENCODING) {
  const decoder = new TextDecoder(encoding === 'utf-8-bom' ? 'utf-8' : encoding, {
    ignoreBOM: true
  })
  return (value, complete = false) =>
    decoder.decode(decodeBase64Bytes(value), { stream: !complete })
}

export function encodeFileText(content, encoding = DEFAULT_ENCODING) {
  if (encoding !== 'utf-8' && encoding !== 'utf-8-bom') {
    throw new Error(`不支持的写入编码: ${encoding}`)
  }
  const text = content.startsWith('\uFEFF') ? content.slice(1) : content
  return encoding === 'utf-8-bom' ? `\uFEFF${text}` : text
}

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
  const decodeBase64ToString = (value, encoding = DEFAULT_ENCODING) =>
    createBase64StreamDecoder(encoding)(value, true)

  const detectEncoding = (content) =>
    content.startsWith('\uFEFF') ? 'utf-8-bom' : DEFAULT_ENCODING

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
    resetEncoding,
    DEFAULT_ENCODING
  }
}
