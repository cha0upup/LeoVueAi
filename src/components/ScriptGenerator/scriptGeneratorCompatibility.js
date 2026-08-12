export const targetJavaMajor = (targetJavaVersion) => {
  if (!targetJavaVersion || targetJavaVersion === 'auto') return null
  const major = Number.parseInt(targetJavaVersion, 10)
  return Number.isFinite(major) ? major : null
}

export const isPackerTargetCompatible = (metadata, targetJavaVersion) => {
  if (metadata?.status === 'failed') return false
  const major = targetJavaMajor(targetJavaVersion)
  if (major === null) return true
  return major >= Number(metadata?.minTargetJava || 6)
}

export const getPackerCompatibilityWarning = (metadata, targetJavaVersion) => {
  const capabilities = Array.isArray(metadata?.requiredCapabilities)
    ? metadata.requiredCapabilities
    : []
  if (!capabilities.includes('javascript-engine')) return ''
  if (targetJavaVersion === '17+') {
    return '该 Packer 需要 JavaScript ScriptEngine；JDK 15+ 默认不再内置 Nashorn，请确认目标环境提供兼容 JS 引擎'
  }
  if (!targetJavaVersion || targetJavaVersion === 'auto') {
    return '该 Packer 依赖目标环境中的 JavaScript ScriptEngine，自动模式无法确认该能力'
  }
  return ''
}

export const isServletNamespaceCompatible = (servletNamespace, targetJavaVersion) => {
  if (servletNamespace !== 'jakarta') return true
  const major = targetJavaMajor(targetJavaVersion)
  return major === null || major >= 8
}
