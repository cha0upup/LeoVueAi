const SCRIPT_LANGUAGE_OPTIONS = Object.freeze({
  java: [
    { value: 'js', label: 'JavaScript' },
    { value: 'groovy', label: 'Groovy' },
    { value: 'python', label: 'Python' }
  ],
  php: [{ value: 'php', label: 'PHP' }]
})

export const SCRIPT_PLACEHOLDERS = Object.freeze({
  js: '// 例：返回当前时间\nvar now = new java.util.Date();\nnow.toString();',
  groovy: '// 例：列出系统属性\nSystem.getProperty("os.name")',
  python: '# 例：读取环境变量\nimport os\nos.environ.get("PATH")',
  php: '// 例：返回当前时间\nreturn ["time" => date(DATE_ATOM)];'
})

export const getScriptLanguageOptions = runtime =>
  runtime === 'php' ? SCRIPT_LANGUAGE_OPTIONS.php : SCRIPT_LANGUAGE_OPTIONS.java

export const createEmptyBytecode = () => ({
  base64: '',
  fileName: '',
  size: 0,
  preview: '',
  magicValid: false
})

const bytesToBase64 = bytes => {
  let binary = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return btoa(binary)
}

export const analyzeBytecode = (bytes, fileName = '') => {
  if (!(bytes instanceof Uint8Array) || bytes.length === 0) {
    throw new TypeError('字节码为空')
  }
  return {
    base64: bytesToBase64(bytes),
    fileName: fileName || '',
    size: bytes.length,
    preview: Array.from(bytes.subarray(0, 16), byte => byte.toString(16).padStart(2, '0')).join(' '),
    magicValid: bytes.length >= 4 &&
      bytes[0] === 0xca && bytes[1] === 0xfe && bytes[2] === 0xba && bytes[3] === 0xbe
  }
}

export const decodeBytecodeBase64 = rawValue => {
  const cleaned = String(rawValue || '').trim().replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
  if (!cleaned) throw new TypeError('字节码为空')
  const padded = cleaned + '='.repeat((4 - (cleaned.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
  return analyzeBytecode(bytes)
}

export const formatByteSize = value => {
  const bytes = Number(value)
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export const formatExecutionResult = data => {
  const stringify = value => {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }
  if (data == null) return ''
  if (typeof data === 'string') return data
  for (const key of ['result', 'output', 'data']) {
    if (data[key] != null) {
      return typeof data[key] === 'string' ? data[key] : stringify(data[key])
    }
  }
  return stringify(data)
}

export const buildPluginPayload = ({ form, mode, language, runtime, script, bytecode, pluginParam }) => {
  const base = {
    pluginName: String(form?.pluginName || '').trim(),
    pluginDescription: String(form?.pluginDescription || '').trim(),
    version: String(form?.version || '').trim() || '1.0'
  }
  return mode === 'script'
    ? {
        ...base,
        pluginType: language,
        runtime,
        language,
        scriptContent: script
      }
    : {
        ...base,
        pluginType: 'java',
        bytecode: bytecode?.base64 || '',
        paramsDemo: form?.paramsDemo ?? pluginParam ?? ''
      }
}
