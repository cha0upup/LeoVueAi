import { reactive, ref } from 'vue'

const DEFAULT_URL_STRATEGY = {
  mode: 'POOL',
  prefix: '',
  urlPoolText: '',
  urlTemplate: '',
  extensionsText: ''
}

const DEFAULT_PADDING_STRATEGY = {
  lengthDistribution: 'UNIFORM',
  minBytes: 64,
  maxBytes: 512
}

const DEFAULT_HEADER_NOISE_STRATEGY = {
  valueMode: 'RANDOM_ALPHANUM',
  minHeaders: 1,
  maxHeaders: 5
}

const DEFAULT_TLS_FINGERPRINT_STRATEGY = {
  profile: 'CHROME_MODERN',
  rotate: false
}

const PADDING_PRESETS = {
  stealth: { lengthDistribution: 'GAUSSIAN', minBytes: 128, maxBytes: 2048 },
  normal: { lengthDistribution: 'UNIFORM', minBytes: 64, maxBytes: 512 },
  light: { lengthDistribution: 'UNIFORM', minBytes: 16, maxBytes: 128 }
}

const splitLines = (value) =>
  String(value || '')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)

const splitCommaList = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

const parseStrategy = (value) => {
  if (!value) return null
  if (typeof value === 'object' && !Array.isArray(value)) return value
  if (typeof value !== 'string' || !value.trim()) return null

  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

/**
 * 主机新增、编辑和导入共用的请求随机化策略状态与序列化逻辑。
 */
export function usePuppetStrategies() {
  const urlStrategyEnabled = ref(false)
  const urlStrategyForm = reactive({ ...DEFAULT_URL_STRATEGY })
  const paddingEnabled = ref(false)
  const paddingPreset = ref('')
  const paddingForm = reactive({ ...DEFAULT_PADDING_STRATEGY })
  const headerNoiseEnabled = ref(false)
  const headerNoiseForm = reactive({ ...DEFAULT_HEADER_NOISE_STRATEGY })
  const tlsFingerprintEnabled = ref(false)
  const tlsFingerprintForm = reactive({ ...DEFAULT_TLS_FINGERPRINT_STRATEGY })

  const resetStrategies = () => {
    urlStrategyEnabled.value = false
    Object.assign(urlStrategyForm, DEFAULT_URL_STRATEGY)
    paddingEnabled.value = false
    paddingPreset.value = ''
    Object.assign(paddingForm, DEFAULT_PADDING_STRATEGY)
    headerNoiseEnabled.value = false
    Object.assign(headerNoiseForm, DEFAULT_HEADER_NOISE_STRATEGY)
    tlsFingerprintEnabled.value = false
    Object.assign(tlsFingerprintForm, DEFAULT_TLS_FINGERPRINT_STRATEGY)
  }

  const parseUrlStrategy = (value) => {
    const strategy = parseStrategy(value)
    urlStrategyEnabled.value = Boolean(strategy?.enabled)
    Object.assign(
      urlStrategyForm,
      DEFAULT_URL_STRATEGY,
      strategy
        ? {
            mode: strategy.mode || DEFAULT_URL_STRATEGY.mode,
            prefix: strategy.prefix || '',
            urlPoolText: Array.isArray(strategy.urlPool) ? strategy.urlPool.join('\n') : '',
            urlTemplate: strategy.urlTemplate || '',
            extensionsText: Array.isArray(strategy.extensions) ? strategy.extensions.join(',') : ''
          }
        : {}
    )
  }

  const parsePaddingStrategy = (value) => {
    const strategy = parseStrategy(value)
    paddingEnabled.value = Boolean(strategy?.enabled)
    Object.assign(
      paddingForm,
      DEFAULT_PADDING_STRATEGY,
      strategy
        ? {
            lengthDistribution:
              strategy.lengthDistribution || DEFAULT_PADDING_STRATEGY.lengthDistribution,
            minBytes: strategy.minBytes ?? DEFAULT_PADDING_STRATEGY.minBytes,
            maxBytes: strategy.maxBytes ?? DEFAULT_PADDING_STRATEGY.maxBytes
          }
        : {}
    )
  }

  const parseHeaderNoiseStrategy = (value) => {
    const strategy = parseStrategy(value)
    headerNoiseEnabled.value = Boolean(strategy?.enabled)
    Object.assign(
      headerNoiseForm,
      DEFAULT_HEADER_NOISE_STRATEGY,
      strategy
        ? {
            valueMode: strategy.valueMode || DEFAULT_HEADER_NOISE_STRATEGY.valueMode,
            minHeaders: strategy.minHeaders ?? DEFAULT_HEADER_NOISE_STRATEGY.minHeaders,
            maxHeaders: strategy.maxHeaders ?? DEFAULT_HEADER_NOISE_STRATEGY.maxHeaders
          }
        : {}
    )
  }

  const parseTlsFingerprintStrategy = (value) => {
    const strategy = parseStrategy(value)
    tlsFingerprintEnabled.value = Boolean(strategy?.enabled)
    Object.assign(
      tlsFingerprintForm,
      DEFAULT_TLS_FINGERPRINT_STRATEGY,
      strategy
        ? {
            profile: strategy.profile || DEFAULT_TLS_FINGERPRINT_STRATEGY.profile,
            rotate: Boolean(strategy.rotate)
          }
        : {}
    )
  }

  const loadStrategies = (puppet = {}) => {
    parseUrlStrategy(puppet.urlStrategy)
    parsePaddingStrategy(puppet.paddingStrategy)
    parseHeaderNoiseStrategy(puppet.headerNoiseStrategy)
    parseTlsFingerprintStrategy(puppet.tlsFingerprintStrategy)
  }

  const applyPaddingPreset = (preset) => {
    const values = PADDING_PRESETS[preset]
    if (!values) return false
    paddingPreset.value = preset
    Object.assign(paddingForm, values)
    return true
  }

  const mergeUrlPoolPaths = (paths) => {
    const incomingPaths = Array.isArray(paths) ? paths : []
    const merged = [
      ...new Set([
        ...splitLines(urlStrategyForm.urlPoolText),
        ...incomingPaths.map((path) => String(path).trim()).filter(Boolean)
      ])
    ]
    urlStrategyForm.urlPoolText = merged.join('\n')
    return merged
  }

  const buildUrlStrategyJson = () => {
    if (!urlStrategyEnabled.value) return ''

    const strategy = {
      enabled: true,
      mode: urlStrategyForm.mode,
      prefix: urlStrategyForm.prefix || null
    }
    if (urlStrategyForm.mode === 'POOL') {
      const urlPool = splitLines(urlStrategyForm.urlPoolText)
      if (urlPool.length) strategy.urlPool = urlPool
    }
    if (urlStrategyForm.mode === 'TEMPLATE' && urlStrategyForm.urlTemplate) {
      strategy.urlTemplate = urlStrategyForm.urlTemplate
    }
    const extensions = splitCommaList(urlStrategyForm.extensionsText)
    if (extensions.length) strategy.extensions = extensions
    return JSON.stringify(strategy)
  }

  const buildPaddingStrategyJson = () =>
    paddingEnabled.value ? JSON.stringify({ enabled: true, ...paddingForm }) : ''

  const buildHeaderNoiseStrategyJson = () =>
    headerNoiseEnabled.value ? JSON.stringify({ enabled: true, ...headerNoiseForm }) : ''

  const buildTlsFingerprintStrategyJson = () => {
    if (!tlsFingerprintEnabled.value) return ''

    const strategy = {
      enabled: true,
      profile: tlsFingerprintForm.profile
    }
    if (tlsFingerprintForm.rotate) strategy.rotate = true
    return JSON.stringify(strategy)
  }

  return {
    urlStrategyEnabled,
    urlStrategyForm,
    paddingEnabled,
    paddingPreset,
    paddingForm,
    headerNoiseEnabled,
    headerNoiseForm,
    tlsFingerprintEnabled,
    tlsFingerprintForm,
    resetStrategies,
    loadStrategies,
    parseUrlStrategy,
    parsePaddingStrategy,
    parseHeaderNoiseStrategy,
    parseTlsFingerprintStrategy,
    applyPaddingPreset,
    mergeUrlPoolPaths,
    buildUrlStrategyJson,
    buildPaddingStrategyJson,
    buildHeaderNoiseStrategyJson,
    buildTlsFingerprintStrategyJson
  }
}
