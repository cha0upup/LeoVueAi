export const BUILD_CHANNEL = Object.freeze({
  RUNTIME: 'runtime',
  WEB: 'web',
  MEMORY: 'memory'
})

export const PHP_OUTPUT_MODES = Object.freeze({
  compact: {
    label: 'Compact',
    title: '精简源码',
    description: '源码级精简，无 zlib 依赖',
    tone: 'recommended'
  },
  packed: {
    label: 'Packed',
    title: '极致体积',
    description: 'DEFLATE 封装，依赖 zlib',
    tone: 'smallest'
  },
  portable: {
    label: 'Portable',
    title: '可读源码',
    description: '保留换行，便于检查调试',
    tone: 'readable'
  }
})

const SNAPSHOT_KEYS = Object.freeze([
  'runtime', 'generateType', 'reqDisguiseId', 'respDisguiseId', 'shellType',
  'protocol', 'coreClassName', 'respCode', 'serverType', 'serverVersion', 'packerType',
  'headerName', 'headerValue', 'urlPattern', 'injectorClassName',
  'shellClassName', 'isAbstractTranslet', 'byPassJavaModule', 'targetJavaVersion',
  'lambdaSuffix', 'staticInitialize', 'shrink', 'servletNamespace', 'phpOutputMode'
])

export function createScriptGeneratorForm() {
  return {
    runtime: 'java',
    generateType: 'webshell',
    reqDisguiseId: '',
    respDisguiseId: '',
    shellType: 'JSP',
    protocol: 'http',
    targetJavaVersion: 'auto',
    servletNamespace: 'auto',
    coreClassName: '',
    respCode: 200,
    serverType: '',
    serverVersion: '',
    packerType: '',
    headerName: '',
    headerValue: '',
    urlPattern: '/*',
    injectorClassName: '',
    shellClassName: '',
    isAbstractTranslet: false,
    byPassJavaModule: false,
    lambdaSuffix: false,
    staticInitialize: false,
    shrink: true,
    jspObfuscationSteps: [],
    phpMinimumVersion: '5.6',
    phpOutputMode: 'compact'
  }
}

export function snapshotBuildForm(form) {
  const snapshot = Object.fromEntries(SNAPSHOT_KEYS.map(key => [key, form[key]]))
  snapshot.jspObfuscationSteps = [...(form.jspObfuscationSteps || [])]
  return snapshot
}

export function isBuildSnapshotStale(form, snapshot) {
  if (!snapshot) return false
  if (SNAPSHOT_KEYS.some(key => snapshot[key] !== form[key])) return true
  return JSON.stringify(snapshot.jspObfuscationSteps || []) !== JSON.stringify(form.jspObfuscationSteps || [])
}

export function createBuildRequest(form, { isJspGroupPacker = () => false } = {}) {
  if (form.runtime === 'php') {
    const params = {
      runtime: 'php',
      artifactType: 'webshell',
      reqDisguiseId: form.reqDisguiseId,
      respDisguiseId: form.respDisguiseId,
      respCode: form.respCode,
      outputMode: form.phpOutputMode || 'compact'
    }
    appendHeaderPair(params, form)
    return { channel: BUILD_CHANNEL.RUNTIME, params, resultKey: 'content' }
  }

  if (form.generateType === 'webshell') {
    const params = {
      reqDisguiseId: form.reqDisguiseId,
      respDisguiseId: form.respDisguiseId,
      shellType: form.shellType,
      targetJavaVersion: form.targetJavaVersion || 'auto',
      respCode: form.respCode
    }
    if (form.shellType === 'JSP' || form.shellType === 'JSPX') {
      params.protocol = form.protocol || 'http'
      params.jspObfuscationSteps = [...(form.jspObfuscationSteps || [])]
    }
    appendTrimmed(params, 'coreClassName', form.coreClassName)
    return { channel: BUILD_CHANNEL.WEB, params, resultKey: 'shell' }
  }

  const protocol = form.protocol || 'http'
  const params = {
    reqDisguiseId: form.reqDisguiseId,
    respDisguiseId: form.respDisguiseId,
    serverType: form.serverType,
    serverVersion: form.serverVersion || undefined,
    shellType: form.shellType,
    packerType: form.packerType,
    protocol,
    targetJavaVersion: form.targetJavaVersion || 'auto',
    servletNamespace: form.servletNamespace || 'auto',
    respCode: form.respCode,
    urlPattern: form.urlPattern || '/*',
    isAbstractTranslet: Boolean(form.isAbstractTranslet),
    lambdaSuffix: Boolean(form.lambdaSuffix),
    staticInitialize: Boolean(form.staticInitialize),
    shrink: form.shrink !== false
  }
  if (protocol !== 'websocket') appendHeaderPair(params, form)
  appendTrimmed(params, 'coreClassName', form.coreClassName)
  appendTrimmed(params, 'injectorClassName', form.injectorClassName)
  appendTrimmed(params, 'shellClassName', form.shellClassName)
  if (form.byPassJavaModule) params.byPassJavaModule = true
  if (isJspGroupPacker(form.packerType)) {
    params.jspObfuscationSteps = [...(form.jspObfuscationSteps || [])]
  }
  return { channel: BUILD_CHANNEL.MEMORY, params, resultKey: 'code' }
}

function appendHeaderPair(params, form) {
  const name = form.headerName?.trim() || ''
  const value = String(form.headerValue ?? '').trim()
  if (name || value) {
    params.headerName = name
    params.headerValue = value
  }
}

function appendTrimmed(params, key, value) {
  const normalized = value?.trim()
  if (normalized) params[key] = normalized
}
