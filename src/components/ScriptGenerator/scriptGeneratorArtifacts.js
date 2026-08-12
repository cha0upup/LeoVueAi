const CLASS_MAGIC = [0xca, 0xfe, 0xba, 0xbe]

export const CLASS_ARTIFACT_ROLE_LABELS = Object.freeze({
  core: 'Core',
  shell: 'Shell',
  injector: 'Injector'
})

/** 只保留后端返回的完整 Class 产物，避免残缺条目进入下载菜单。 */
export function normalizeClassArtifacts(value) {
  if (!Array.isArray(value)) return []
  return value
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      role: String(item.role || '').trim().toLowerCase(),
      className: String(item.className || '').trim(),
      entryName: String(item.entryName || '').trim(),
      fileName: resolveClassArtifactFileName(item),
      sizeBytes: Number(item.sizeBytes) || 0,
      sha256: String(item.sha256 || '').trim().toLowerCase(),
      mediaType: String(item.mediaType || 'application/java-vm'),
      contentEncoding: String(item.contentEncoding || '').trim().toLowerCase(),
      content: String(item.content || '').replace(/\s+/g, '')
    }))
    .filter(item => item.role && item.className && item.contentEncoding === 'base64' && item.content)
}

export function decodeClassArtifact(artifact) {
  const normalized = normalizeClassArtifacts([artifact])[0]
  if (!normalized) throw new TypeError('Class 产物数据不完整')

  let decoded
  try {
    decoded = globalThis.atob(normalized.content)
  } catch {
    throw new TypeError('Class 产物 Base64 内容无效')
  }
  const bytes = new Uint8Array(decoded.length)
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index)
  }

  if (normalized.sizeBytes && normalized.sizeBytes !== bytes.byteLength) {
    throw new TypeError('Class 产物长度校验失败')
  }
  if (!CLASS_MAGIC.every((value, index) => bytes[index] === value)) {
    throw new TypeError('Class 产物文件头校验失败')
  }
  return bytes
}

export function resolveClassArtifactFileName(artifact) {
  const explicit = String(artifact?.fileName || '').split(/[\\/]/).pop()?.trim()
  if (explicit) return explicit.endsWith('.class') ? explicit : `${explicit}.class`

  const className = String(artifact?.className || '').trim()
  const simpleName = className.split('.').pop() || 'Generated'
  return `${simpleName}.class`
}

export function formatClassArtifactLabel(artifact) {
  const role = CLASS_ARTIFACT_ROLE_LABELS[artifact?.role] || artifact?.role || 'Class'
  const size = Number(artifact?.sizeBytes) || 0
  return `${role} · ${size.toLocaleString()} B`
}
