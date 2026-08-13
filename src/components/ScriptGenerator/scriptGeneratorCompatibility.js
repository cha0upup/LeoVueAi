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

export const getInjectorSupportedPackers = (capability, serverVersion) => {
  const versionPackers = capability?.supportedPackersByServerVersion?.[serverVersion]
  return Array.isArray(versionPackers) ? versionPackers : capability?.supportedPackers
}

export const isInjectorPackerCompatible = (capability, serverVersion, packer) => {
  const supported = getInjectorSupportedPackers(capability, serverVersion)
  return !Array.isArray(supported)
    || (supported.length === 0 && packer !== 'AgentJarBase64')
    || supported.includes(packer)
}

const NON_SERVLET_MOUNT_TYPES = new Set([
  'web-filter',
  'handler-method',
  'handler-function',
  'netty-handler',
  'dubbo-service'
])

export const usesServletNamespace = capability =>
  !NON_SERVLET_MOUNT_TYPES.has(capability?.mountType)

export const getInjectorRouteField = (capability, protocol) => {
  if (protocol === 'websocket') {
    return { label: 'Endpoint 路径', placeholder: '例如 /leo，不支持通配符' }
  }
  if (capability?.mountType === 'dubbo-service') {
    return { label: '服务接口名（/* 表示自动生成）', placeholder: '默认根据 Shell 类名生成' }
  }
  if (capability?.mountType === 'handler-method' || capability?.mountType === 'handler-function') {
    return { label: '路由路径', placeholder: '默认 /*' }
  }
  return { label: 'URL 匹配范围', placeholder: '默认 /*' }
}
