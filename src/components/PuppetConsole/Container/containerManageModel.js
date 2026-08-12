const asArray = value => Array.isArray(value) ? value : []
const asObject = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {}

export const getContextDisplayName = context => String(context?.name || 'ROOT')

export const getContextKey = context => context?.contextId || null

export const getContextAssetScore = context =>
  asArray(context?.allServlet).length +
  asArray(context?.allFilter).length +
  asArray(context?.allValve).length +
  asArray(context?.allListener).length

export const sortRuntimeContexts = contexts =>
  [...asArray(contexts)].sort((left, right) => {
    const leftRoot = getContextDisplayName(left) === 'ROOT'
    const rightRoot = getContextDisplayName(right) === 'ROOT'
    if (leftRoot !== rightRoot) return leftRoot ? -1 : 1
    const scoreDifference = getContextAssetScore(right) - getContextAssetScore(left)
    return scoreDifference || getContextDisplayName(left).localeCompare(getContextDisplayName(right))
  })

export const filterRuntimeContexts = (contexts, keyword) => {
  const query = String(keyword || '').trim().toLocaleLowerCase()
  const sorted = sortRuntimeContexts(contexts)
  if (!query) return sorted
  return sorted.filter(context => [
    getContextDisplayName(context),
    context?.basePath || '/',
    context?.host || '',
    context?.workDir || '',
    getContextKey(context) || ''
  ].some(value => String(value).toLocaleLowerCase().includes(query)))
}

const normalizeContext = (context, runtime) => {
  const components = asObject(context?.components)
  const frameworks = asArray(context?.frameworks)
  return {
    ...context,
    contextId: String(context?.contextId || `${runtime.runtimeId}:${context?.host || 'default'}:${context?.path || '/'}`),
    basePath: String(context?.path || '/'),
    runtimeId: runtime.runtimeId,
    capabilities: asObject(runtime.capabilities),
    allServlet: asArray(components.servlet),
    allFilter: asArray(components.filter),
    allListener: asArray(components.listener),
    allValve: asArray(components.valve),
    frameworks,
    frameworkInfo: frameworks[0] || null
  }
}

export const normalizeWebRuntimePayload = data => {
  if (!data || typeof data !== 'object') {
    return { ok: false, error: '获取 Web Runtime 信息失败', runtimes: [], contexts: [] }
  }
  if (Number(data.schemaVersion) !== 2 || !Array.isArray(data.runtimes)) {
    return { ok: false, error: 'Web Runtime 数据协议版本不匹配', runtimes: [], contexts: [] }
  }

  const runtimes = data.runtimes
    .filter(runtime => runtime && typeof runtime === 'object')
    .map(runtime => ({
      ...runtime,
      capabilities: asObject(runtime.capabilities),
      contexts: asArray(runtime.contexts).map(context => normalizeContext(context, runtime)),
      frameworks: asArray(runtime.frameworks)
    }))
  return {
    ok: true,
    error: null,
    schemaVersion: 2,
    scanId: data.scanId || null,
    diagnostics: asArray(data.diagnostics),
    runtimes,
    contexts: runtimes.flatMap(runtime => runtime.contexts)
  }
}

export const normalizeRuntimeOperation = data => {
  if (!data || typeof data !== 'object') {
    return { ok: false, error: '组件操作返回为空' }
  }
  if (data.status === 'CHANGED' && data.verified === true) {
    return { ok: true, status: data.status }
  }
  const diagnostic = asArray(data.diagnostics)[0]
  return {
    ok: false,
    status: data.status || 'FAILED',
    error: diagnostic || (data.status === 'NOT_FOUND' ? '组件已不存在' : '组件操作未通过验证')
  }
}

export const getControllerClassName = description => {
  const match = String(description || '').match(/([a-zA-Z0-9_$.]+)[.#][a-zA-Z0-9_$]+(?:\(|$)/)
  return match?.[1] || ''
}

export const getControllerMethodName = description => {
  const match = String(description || '').match(/[.#]([a-zA-Z0-9_$]+)(?:\(|$)/)
  return match?.[1] || ''
}
