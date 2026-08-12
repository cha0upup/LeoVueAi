export const AI_PROTOCOL = Object.freeze({
  responses: 'responses',
  chatCompletions: 'chat_completions'
})

export const DEFAULT_COMPLETIONS_PATH = '/v1/chat/completions'
const RESPONSES_PATH = '/responses'

export const AI_PROTOCOL_OPTIONS = [
  { label: 'Responses API', value: AI_PROTOCOL.responses },
  { label: 'Chat Completions', value: AI_PROTOCOL.chatCompletions }
]

export const REASONING_MODE_OPTIONS = [
  { label: '按模型默认', value: null },
  { label: '开启', value: 1 },
  { label: '关闭', value: 0 }
]

export const REASONING_EFFORT_OPTIONS = [
  { label: '自动', value: 'auto' },
  { label: '低', value: 'low' },
  { label: '中', value: 'medium' },
  { label: '高', value: 'high' },
  { label: '极高', value: 'xhigh' }
]

export function normalizeProtocol(value) {
  return value === AI_PROTOCOL.responses ? AI_PROTOCOL.responses : AI_PROTOCOL.chatCompletions
}

export function defaultPathForProtocol(protocol) {
  return normalizeProtocol(protocol) === AI_PROTOCOL.responses
    ? RESPONSES_PATH
    : DEFAULT_COMPLETIONS_PATH
}

export function createModelForm() {
  return {
    name: '',
    providerId: null,
    providerKey: 'custom',
    providerName: '',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: '',
    protocol: AI_PROTOCOL.responses,
    completionsPath: RESPONSES_PATH,
    thinkingEnabled: null,
    reasoningEffort: 'auto',
    maxOutputTokens: null,
    contextWindowTokens: null,
    temperature: null,
    fallbackModelId: null,
    headersJson: '',
    remark: '',
    enabledBool: true,
    isActiveBool: true
  }
}

export function createProviderForm() {
  return {
    name: '',
    providerKey: 'custom',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    protocol: AI_PROTOCOL.responses,
    completionsPath: RESPONSES_PATH,
    headersJson: '',
    remark: '',
    enabledBool: true,
    models: []
  }
}

export function createCapabilityForm() {
  return {
    modelName: '',
    source: 'manual',
    contextWindowTokens: 32768,
    maxOutputTokens: 4096,
    supportsTextGenerationBool: true,
    supportsReasoningBool: false,
    supportsStreamingBool: true,
    supportsFunctionCallingBool: false,
    supportsStructuredOutputBool: false,
    supportsWebSearchBool: false,
    supportsParallelToolCallsBool: false,
    remark: ''
  }
}

export function normalizeCapabilityKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

export function normalizeModelNameForCapability(modelName, providerKey = '') {
  const value = normalizeCapabilityKey(modelName)
  if (!value.includes('/')) return value

  const [prefix, tail] = value.split('/', 2)
  const knownPrefixes = [
    'openai',
    'deepseek',
    'qwen',
    'dashscope',
    'mimo',
    'gemini',
    'moonshot',
    'zhipu'
  ]
  const aggregatorProviders = ['openrouter', 'litellm', 'oneapi']
  return knownPrefixes.includes(prefix) ||
    aggregatorProviders.includes(normalizeCapabilityKey(providerKey))
    ? tail
    : value
}

export function capabilityIdentityLabel(model) {
  if (!model) return ''
  return (
    model.capabilityModelName ||
    normalizeModelNameForCapability(model.model || model.name || '', model.providerKey)
  )
}

export function capabilityToForm(row) {
  return {
    modelName: row?.modelName || '',
    source: row?.source || 'manual',
    contextWindowTokens: Number(row?.contextWindowTokens || 32768),
    maxOutputTokens: Number(row?.maxOutputTokens || 4096),
    supportsTextGenerationBool: row?.supportsTextGeneration !== 0,
    supportsReasoningBool: row?.supportsReasoning === 1 || row?.supportsReasoning === true,
    supportsStreamingBool: row?.supportsStreaming !== 0,
    supportsFunctionCallingBool:
      row?.supportsFunctionCalling === 1 || row?.supportsFunctionCalling === true,
    supportsStructuredOutputBool:
      row?.supportsStructuredOutput === 1 || row?.supportsStructuredOutput === true,
    supportsWebSearchBool: row?.supportsWebSearch === 1 || row?.supportsWebSearch === true,
    supportsParallelToolCallsBool: row?.supportsParallelToolCalls !== 0,
    remark: row?.remark || ''
  }
}

export function buildCapabilityBody(form) {
  return {
    modelName: form.modelName.trim(),
    source: form.source || 'manual',
    contextWindowTokens: form.contextWindowTokens,
    maxOutputTokens: form.maxOutputTokens,
    supportsTextGeneration: form.supportsTextGenerationBool ? 1 : 0,
    supportsReasoning: form.supportsReasoningBool ? 1 : 0,
    supportsStreaming: form.supportsStreamingBool ? 1 : 0,
    supportsFunctionCalling: form.supportsFunctionCallingBool ? 1 : 0,
    supportsStructuredOutput: form.supportsStructuredOutputBool ? 1 : 0,
    supportsWebSearch: form.supportsWebSearchBool ? 1 : 0,
    supportsParallelToolCalls: form.supportsParallelToolCallsBool ? 1 : 0,
    remark: form.remark || ''
  }
}

export function resetReactiveForm(form, initial) {
  Object.keys(form).forEach((key) => delete form[key])
  Object.assign(form, initial)
}

export function buildProviderRows(savedProviders, models) {
  const providers = Array.isArray(savedProviders) ? savedProviders : []
  const modelRows = Array.isArray(models) ? models : []
  const map = new Map()

  providers.forEach((provider) => {
    map.set(provider.id, {
      ...provider,
      models: [],
      hasDefault: false
    })
  })

  modelRows.forEach((model) => {
    const provider = map.get(model.providerId)
    if (!provider) return
    provider.models.push(model)
    provider.hasDefault ||= model.isActive === 1
  })

  return [...map.values()]
}

export function filterProviderRows(providerRows, keyword) {
  const query = String(keyword || '')
    .trim()
    .toLowerCase()
  if (!query) return providerRows
  return providerRows.filter(
    (provider) =>
      [provider.name, provider.providerKey, provider.baseUrl, provider.completionsPath].some(
        (value) =>
          String(value || '')
            .toLowerCase()
            .includes(query)
      ) ||
      provider.models.some((model) =>
        [model.name, model.model].some((value) =>
          String(value || '')
            .toLowerCase()
            .includes(query)
        )
      )
  )
}

export function providerRowKey(row) {
  return row.id
}

export function providerTestModelId(provider) {
  const models = Array.isArray(provider?.models) ? provider.models : []
  return (models.find((model) => model.enabled !== 0) || models[0])?.id ?? null
}

export function providerInitial(provider) {
  const name = provider?.name || provider?.providerKey || 'AI'
  return String(name).trim().slice(0, 1).toUpperCase()
}

export function formatNumber(value) {
  return Number(value || 0).toLocaleString()
}

export function shortTokens(value) {
  const amount = Number(value || 0)
  if (amount >= 1_000_000) return `${Math.round(amount / 100_000) / 10}M`
  if (amount >= 1_000) return `${Math.round(amount / 1_000)}K`
  return `${amount}`
}

export function capabilitySourceLabel(value) {
  return (
    {
      manual: '开发者维护',
      system: '系统内置',
      official: '官方能力库',
      probe: '真实探测',
      capability_library: '未收录',
      conservative_default: '保守默认'
    }[value] ||
    value ||
    '能力库'
  )
}

export function effectiveLimitLabel(model) {
  if (!model) return ''
  if (!model.capabilityRecognized) {
    return '该模型未收录到能力库，系统将使用保守默认上限：32K 上下文 / 4K 输出。'
  }
  const hasContextLimit = Number(model.contextWindowTokens || 0) > 0
  const hasOutputLimit = Number(model.maxOutputTokens || 0) > 0
  if (!hasContextLimit && !hasOutputLimit) {
    return '使用模型能力上限，系统调用时不额外压低上下文或输出长度。'
  }
  return '已配置自定义限制；系统会自动裁剪到模型真实能力上限以内。'
}

export function healthStatusLabel(status) {
  return (
    {
      open: '熔断中',
      degraded: '不稳定',
      healthy: '健康'
    }[status] || '未探测'
  )
}

export function healthTagType(status) {
  return (
    {
      open: 'danger',
      degraded: 'warning',
      healthy: 'success'
    }[status] || 'info'
  )
}

export function supportItems(model) {
  return [
    { label: '文本生成', enabled: model.supportsTextGeneration },
    { label: '深度思考', enabled: model.supportsReasoning },
    { label: '流式输出', enabled: model.supportsStreaming },
    { label: '函数调用', enabled: model.supportsFunctionCalling },
    { label: '结构化输出', enabled: model.supportsStructuredOutput },
    { label: '联网搜索', enabled: model.supportsWebSearch },
    { label: '并行工具', enabled: model.supportsParallelToolCalls }
  ]
}

export function probeSummary(items) {
  const labels = {
    textGeneration: '文本',
    streaming: '流式',
    functionCalling: '工具',
    structuredOutput: 'JSON',
    reasoning: '推理'
  }
  return (items || [])
    .map((item) => {
      const mark = item.status === 'supported' ? '✓' : item.status === 'unsupported' ? '×' : '？'
      return `${labels[item.feature] || item.feature}${mark}`
    })
    .join('、')
}

export function probeFeatureLabel(feature) {
  return (
    {
      textGeneration: '文本生成',
      streaming: '流式输出',
      functionCalling: '工具调用',
      structuredOutput: 'JSON 输出',
      reasoning: 'Reasoning'
    }[feature] || feature
  )
}

export function probeStatusLabel(status) {
  return (
    {
      supported: '已确认',
      unsupported: '不支持',
      inconclusive: '不确定',
      skipped: '未执行'
    }[status] || '未知'
  )
}

export function probeStatusType(status) {
  return (
    {
      supported: 'success',
      unsupported: 'danger',
      inconclusive: 'warning'
    }[status] || 'info'
  )
}
