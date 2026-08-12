<template>
  <div class="home-content module-shell script-generator-page">
    <div class="script-workbench">
      <div class="content-split">
        <ScriptGeneratorConfigPanel
          v-model:form="form"
          :current-mode-label="currentModeLabel"
          :disguises="availableDisguises"
          :runtime-generators="runtimeGenerators"
          :server-types="serverTypes"
          :available-injector-shell-types="availableInjectorShellTypes"
          :injector-capabilities="injectorCapabilities"
          :packer-types-structure="packerTypesStructure"
          :packer-types-flat="packerTypesFlat"
          :target-java-versions="targetJavaVersions"
          :packer-compatibility="packerCompatibility"
          :servlet-namespaces="servletNamespaces"
          :transport-protocols="transportProtocols"
          :obfuscation-steps="obfuscationSteps"
          :packer-obfuscation-steps="packerObfuscationSteps"
          @set-generate-type="setGenerateType"
          @set-runtime="setRuntime"
          @server-type-change="handleServerTypeChange"
          @generate-random-header="generateRandomHeader"
        />

        <ScriptGeneratorPreviewPanel
          :output-result="outputResult"
          :is-form-valid="isFormValid"
          :result-meta="resultMeta"
          :config-summary="configSummary"
          :class-artifacts="generatedClassArtifacts"
          :is-result-stale="isResultStale"
          :is-saving-artifact="isSavingArtifact"
          @copy="copyToClipboard"
          @generate="GenShell"
          @save-artifact="saveArtifact"
          @copy-summary="copyConfigSummary"
          @download-class-artifact="downloadGeneratedClass"
          @container-ready="handleEditorContainerReady"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, toRaw, watch } from 'vue'

import * as monaco from 'monaco-editor'
import { useMonacoEditorInstance } from '@/composables/useMonacoEditorInstance.js'
import { createMonacoEditorOptions } from '@/composables/useMonacoEditorOptions.js'
import { useMonacoTheme } from '@/composables/useMonacoTheme.js'
import { showError, showSuccess, showWarning } from '@/utils/messageUtils.js'
import { downloadBlob } from '@/utils/downloadBlob.js'
import {
  getDisguisesApi,
  getShellGeneratorSupportedTypesApi,
  generateWebShellApi,
  generateMemoryShellApi,
  generateRuntimeScriptApi,
  getObfuscationStepsApi
} from '@/services/api.js'
import {
  ARTIFACT_CATEGORY,
  archiveTextArtifact,
  sanitizeArtifactName
} from '@/utils/artifactArchive.js'
import ScriptGeneratorConfigPanel from './ScriptGeneratorConfigPanel.vue'
import ScriptGeneratorPreviewPanel from './ScriptGeneratorPreviewPanel.vue'
import { isScriptGeneratorFormValid } from './scriptGeneratorValidation.js'
import {
  BUILD_CHANNEL,
  PHP_OUTPUT_MODES,
  createBuildRequest,
  createScriptGeneratorForm,
  isBuildSnapshotStale,
  snapshotBuildForm
} from './scriptGeneratorBuildModel.js'
import {
  isPackerTargetCompatible,
  isServletNamespaceCompatible
} from './scriptGeneratorCompatibility.js'
import {
  filterPackerTypesStructure,
  normalizeTransportProtocol,
  reconcileMemoryProtocolSelection
} from './scriptGeneratorProtocolCompatibility.js'
import {
  decodeClassArtifact,
  normalizeClassArtifacts
} from './scriptGeneratorArtifacts.js'

const { disposeEditorInstance, recreateEditorInstance } = useMonacoEditorInstance()
const { monacoTheme, watchMonacoTheme } = useMonacoTheme()

// 表单数据
const form = reactive(createScriptGeneratorForm())

// 数据
const Disguises = ref([])
const supportedTypes = ref({
  serverProtocolInjectorTypes: {},
  injectorCapabilities: [],
  packerTypes: { groups: [], ungrouped: [], flat: [] },
  packerObfuscationSteps: {},
  packerCompatibility: {},
  packerAvailability: {},
  targetJavaVersions: ['auto', '6', '7', '8', '9+', '17+'],
  servletNamespaces: ['auto', 'javax', 'jakarta'],
  transportProtocols: {
    webshell: ['http', 'httpchunk'],
    memoryshell: ['http', 'httpchunk', 'websocket']
  },
  runtimeGenerators: {}
})
const outputResult = ref('')
const memoryMetadata = ref(null)
const webMetadata = ref(null)
const obfuscationSteps = ref([])
const monacoEditor = ref(null)
const monacoContainer = ref(null)
/** 上次成功生成时的 form 快照，用于检测配置是否已变更 */
const lastGeneratedForm = ref(null)
const isSavingArtifact = ref(false)

/** 生成结果是否已过期（生成后有字段被修改） */
const isResultStale = computed(() => {
  if (!outputResult.value || !lastGeneratedForm.value) return false
  return isBuildSnapshotStale(form, lastGeneratedForm.value)
})

const isPhpRuntime = computed(() => form.runtime === 'php')
const runtimeGenerators = computed(() => supportedTypes.value.runtimeGenerators || {})
const phpGeneratorMetadata = computed(() => runtimeGenerators.value.php || {})
const availableDisguises = computed(() => {
  if (!isPhpRuntime.value) return Disguises.value
  return Disguises.value.filter((item) =>
    Array.isArray(item.supportedRuntimes)
      ? item.supportedRuntimes.some((runtime) => String(runtime).toLowerCase() === 'php')
      : Boolean(item.phpEncodeBody && item.phpDecodeBody)
  )
})

/** 当前协议对应的应用服务器与 Injector 能力矩阵。 */
const protocolServerInjectorTypes = computed(() => {
  const byProtocol = supportedTypes.value.serverProtocolInjectorTypes
  return byProtocol[normalizeTransportProtocol(form.protocol)] || {}
})
const serverTypes = computed(() => Object.keys(protocolServerInjectorTypes.value))

/** 与接口 data.packerTypes 对齐，并按后端声明的协议能力过滤。 */
const packerTypesStructure = computed(() => filterPackerTypesStructure(
  supportedTypes.value.packerTypes,
  supportedTypes.value.packerCompatibility,
  form.protocol
))

const packerTypesFlat = computed(() => packerTypesStructure.value.flat)

/** packer 名称 -> 支持的混淆步骤 ID 列表（空列表表示不支持） */
const packerObfuscationSteps = computed(() => supportedTypes.value.packerObfuscationSteps || {})
const packerCompatibility = computed(() => supportedTypes.value.packerCompatibility || {})
const targetJavaVersions = computed(() => supportedTypes.value.targetJavaVersions || ['auto', '6', '7', '8', '9+', '17+'])
const servletNamespaces = computed(() => supportedTypes.value.servletNamespaces || ['auto', 'javax', 'jakarta'])
const transportProtocols = computed(() => supportedTypes.value.transportProtocols || {
  webshell: ['http', 'httpchunk'],
  memoryshell: ['http', 'httpchunk', 'websocket']
})
const injectorCapabilities = computed(() => supportedTypes.value.injectorCapabilities || [])

const selectedPackerCompatible = computed(() => {
  if (isPhpRuntime.value || form.generateType !== 'memoryshell' || !form.packerType) return true
  return isPackerTargetCompatible(
    packerCompatibility.value[form.packerType],
    form.targetJavaVersion
  )
})

const moduleBypassCompatible = computed(() => {
  if (isPhpRuntime.value || !form.byPassJavaModule || form.targetJavaVersion === 'auto') return true
  return Number.parseInt(form.targetJavaVersion, 10) >= 9
})

const servletNamespaceCompatible = computed(() =>
  isPhpRuntime.value || isServletNamespaceCompatible(form.servletNamespace, form.targetJavaVersion)
)

/** 判断 packer 是否属于 Jsp 分组（与 ConfigPanel.isJspPackerSelected 保持一致） */
const isJspGroupPacker = (packerType) => {
  if (!packerType) return false
  for (const group of (packerTypesStructure.value.groups || [])) {
    if (group.groupName === 'Jsp' && Array.isArray(group.packers) && group.packers.includes(packerType)) {
      return true
    }
  }
  return false
}
const currentModeLabel = computed(() => isPhpRuntime.value
  ? 'PHP WebShell'
  : (form.generateType === 'webshell' ? 'Java WebShell' : 'Java 内存构建'))

const memoryPayloadText = computed(() => {
  if (form.generateType !== 'memoryshell') return ''
  return outputResult.value || ''
})

/** 后端从同一次构建中导出的 Core / Shell / Injector Class 文件。 */
const generatedClassArtifacts = computed(() => normalizeClassArtifacts(
  memoryMetadata.value?.classArtifacts || webMetadata.value?.classArtifacts
))

const availableInjectorShellTypes = computed(() => {
  if (!form.serverType) return []
  return protocolServerInjectorTypes.value[form.serverType] || []
})
const selectedInjectorCapability = computed(() => injectorCapabilities.value.find(item =>
  item?.serverType === form.serverType
    && item?.protocol === form.protocol
    && item?.injectorName === form.shellType
))
const injectorNamespaceCompatible = computed(() => {
  const supported = selectedInjectorCapability.value?.servletNamespaces
  const namespace = form.servletNamespace === 'auto' ? 'javax' : form.servletNamespace
  return !Array.isArray(supported) || supported.includes(namespace)
})
const injectorServerVersionCompatible = computed(() => {
  const capability = selectedInjectorCapability.value
  if (!capability?.requiresServerVersion) return true
  return Array.isArray(capability.serverVersions)
    && capability.serverVersions.includes(form.serverVersion)
})
const injectorPackerCompatible = computed(() => {
  const supported = selectedInjectorCapability.value?.supportedPackers
  return (!Array.isArray(supported)
    || (supported.length === 0 && form.packerType !== 'AgentJarBase64')
    || supported.includes(form.packerType)
  )
})

const memorySelectionCompatible = computed(() => {
  if (isPhpRuntime.value || form.generateType !== 'memoryshell') return true
  return serverTypes.value.includes(form.serverType)
    && availableInjectorShellTypes.value.includes(form.shellType)
    && packerTypesFlat.value.includes(form.packerType)
})

const isFormValid = computed(() =>
  isScriptGeneratorFormValid(form) && selectedPackerCompatible.value
    && moduleBypassCompatible.value && servletNamespaceCompatible.value
    && memorySelectionCompatible.value && injectorNamespaceCompatible.value
    && injectorServerVersionCompatible.value && injectorPackerCompatible.value
)

const findDisguiseLabel = (id) => {
  if (!id) return '-'
  const item = Disguises.value.find((disguise) => disguise.disguiseId === id)
  return item ? `${item.disguiseName}(${item.version})` : id
}

const configSummary = computed(() => {
  if (isPhpRuntime.value) {
    return [
      { label: '运行时', value: 'PHP' },
      { label: '协议', value: 'HTTP' },
      { label: '最低版本', value: `PHP ${form.phpMinimumVersion || '5.6'}+` },
      { label: '输出模式', value: `${PHP_OUTPUT_MODES[form.phpOutputMode]?.label || form.phpOutputMode} ${PHP_OUTPUT_MODES[form.phpOutputMode]?.title || ''}`.trim() },
      { label: '请求伪装', value: findDisguiseLabel(form.reqDisguiseId) },
      { label: '响应伪装', value: findDisguiseLabel(form.respDisguiseId) },
      { label: '响应码', value: form.respCode || '-' },
      { label: '按需加载组件', value: '全部' },
      { label: 'Header 校验', value: form.headerName ? `${form.headerName}: ${form.headerValue}` : '关闭' }
    ]
  }
  const base = [
    {
      label: '协议',
      value: form.protocol?.toUpperCase() || '-'
    },
    { label: '类型', value: form.shellType || '-' },
    { label: '请求伪装', value: findDisguiseLabel(form.reqDisguiseId) },
    { label: '响应伪装', value: findDisguiseLabel(form.respDisguiseId) },
    { label: '响应码', value: form.respCode || '-' },
    { label: '目标 JDK', value: form.targetJavaVersion || 'auto' },
    { label: '核心类名', value: form.coreClassName || '随机生成' }
  ]

  if (form.generateType === 'memoryshell') {
    return [
      { label: '宿主', value: form.serverType || '-' },
      ...(selectedInjectorCapability.value?.requiresServerVersion
        ? [{ label: '宿主版本', value: form.serverVersion || '-' }]
        : []),
      { label: 'Packer', value: form.packerType || '-' },
      { label: 'Servlet API', value: form.servletNamespace || 'auto' },
      { label: 'Lambda 后缀', value: form.lambdaSuffix ? '开启' : '关闭' },
      ...(selectedInjectorCapability.value?.supportsStaticInitialize === false
        ? []
        : [{ label: '静态初始化', value: form.staticInitialize ? '开启' : '关闭' }]),
      { label: 'Class 瘦身', value: form.shrink ? '开启' : '关闭' },
      {
        label: 'Header 门禁',
        value: form.headerName ? `${form.headerName}: ${form.headerValue || '-'}` : '-'
      },
      ...base.slice(1)
    ]
  }

  return base
})

const configSummaryText = computed(() =>
  configSummary.value.map((item) => `${item.label}: ${item.value}`).join('\n')
)

const resultMeta = computed(() => {
  if (isPhpRuntime.value) {
    const metadata = webMetadata.value?.metadata || webMetadata.value || {}
    return [
      { label: '运行时', value: 'PHP' },
      { label: '协议', value: metadata.protocol || 'http' },
      { label: '最低版本', value: `PHP ${metadata.minimumVersion || '5.6'}+` },
      { label: '输出模式', value: metadata.outputMode || form.phpOutputMode || 'compact' },
      { label: '伪装协议', value: `v${metadata.protocolVersion || 2}` },
      { label: '内核协议', value: metadata.coreProtocol || 'M0-M3' },
      { label: '按需加载组件', value: metadata.components?.length ? `全部（${metadata.components.length}）` : '全部' },
      { label: '加载模式', value: metadata.componentDeliveryMode || 'on-demand-disk-cache' },
      { label: '启动器编码', value: metadata.bootstrapEncoding || 'minified-php' },
      { label: '生成体积', value: metadata.generatedBytes ? `${(metadata.generatedBytes / 1024).toFixed(1)} KB` : '-' },
      { label: '字符编码', value: 'UTF-8' }
    ]
  }
  if (form.generateType === 'webshell') {
    const result = [
      { label: '协议', value: webMetadata.value?.protocol || form.protocol?.toUpperCase() || '-' },
      {
        label: '核心类名',
        value: webMetadata.value?.coreClassName || form.coreClassName || '随机生成'
      },
      { label: '类型', value: webMetadata.value?.type || form.shellType || '-' },
      { label: '目标 JDK', value: webMetadata.value?.targetJavaVersion || form.targetJavaVersion || 'auto' },
      { label: '字符编码', value: 'UTF-8' }
    ]
    if (generatedClassArtifacts.value.length) {
      result.push({ label: 'Class 产物', value: `${generatedClassArtifacts.value.length} 个` })
    }
    return result
  }

  const result = [
    { label: '协议', value: memoryMetadata.value?.protocol || form.protocol?.toUpperCase() || '-' },
    { label: '宿主', value: memoryMetadata.value?.serverType || form.serverType || '-' },
    ...(memoryMetadata.value?.serverVersion || form.serverVersion
      ? [{ label: '宿主版本', value: memoryMetadata.value?.serverVersion || form.serverVersion }]
      : []),
    { label: '注入器', value: memoryMetadata.value?.shellType || form.shellType || '-' },
    { label: 'Packer', value: memoryMetadata.value?.packerType || form.packerType || '-' },
    { label: '目标 JDK', value: memoryMetadata.value?.targetJavaVersion || form.targetJavaVersion || 'auto' },
    { label: 'Servlet API', value: memoryMetadata.value?.servletNamespace || form.servletNamespace || 'javax' },
    { label: '模块兼容', value: memoryMetadata.value?.byPassJavaModule ? '开启' : '关闭' },
    { label: 'Lambda 后缀', value: memoryMetadata.value?.lambdaSuffix ? '开启' : '关闭' },
    { label: '静态初始化', value: memoryMetadata.value?.staticInitialize ? '开启' : '关闭' },
    { label: 'Class 瘦身', value: memoryMetadata.value?.shrink === false ? '关闭' : '开启' },
    ...(memoryMetadata.value?.activationConfig
      ? [{ label: '激活请求头', value: memoryMetadata.value.activationConfig }]
      : []),
    { label: 'Payload 长度', value: memoryPayloadText.value ? memoryPayloadText.value.length : '-' }
  ]
  if (generatedClassArtifacts.value.length) {
    result.push({ label: 'Class 产物', value: `${generatedClassArtifacts.value.length} 个` })
  }
  return result
})

// 方法
const getAllDisguises = async () => {
  try {
    const resp = await getDisguisesApi()
    Disguises.value = resp.data || []
    // 设置默认值
    if (Disguises.value.length > 0) {
      const defaultDisguise =
        Disguises.value.find((d) => d.disguiseId === 'inner_AESBin_1.0.0') || Disguises.value[0]
      form.reqDisguiseId = defaultDisguise.disguiseId
      form.respDisguiseId = defaultDisguise.disguiseId
    }
  } catch {
    showError('获取伪装列表失败')
  }
}

const getSupportedTypes = async () => {
  try {
    const resp = await getShellGeneratorSupportedTypesApi()
    const raw = resp.data || {}
    const pt = raw.packerTypes || {}
    supportedTypes.value = {
      serverProtocolInjectorTypes: (raw.serverProtocolInjectorTypes && typeof raw.serverProtocolInjectorTypes === 'object')
        ? raw.serverProtocolInjectorTypes
        : {},
      injectorCapabilities: Array.isArray(raw.injectorCapabilities)
        ? raw.injectorCapabilities
        : [],
      packerTypes: {
        groups: Array.isArray(pt.groups) ? pt.groups : [],
        ungrouped: Array.isArray(pt.ungrouped) ? pt.ungrouped : [],
        flat: Array.isArray(pt.flat) ? pt.flat : []
      },
      packerObfuscationSteps: (raw.packerObfuscationSteps && typeof raw.packerObfuscationSteps === 'object')
        ? raw.packerObfuscationSteps
        : {},
      packerCompatibility: (raw.packerCompatibility && typeof raw.packerCompatibility === 'object')
        ? raw.packerCompatibility
        : {},
      packerAvailability: (raw.packerAvailability && typeof raw.packerAvailability === 'object')
        ? raw.packerAvailability
        : {},
      targetJavaVersions: Array.isArray(raw.targetJavaVersions)
        ? raw.targetJavaVersions
        : ['auto', '6', '7', '8', '9+', '17+'],
      servletNamespaces: Array.isArray(raw.servletNamespaces)
        ? raw.servletNamespaces
        : ['auto', 'javax', 'jakarta'],
      transportProtocols: (raw.transportProtocols && typeof raw.transportProtocols === 'object')
        ? raw.transportProtocols
        : {
            webshell: ['http', 'httpchunk'],
            memoryshell: ['http', 'httpchunk', 'websocket']
          },
      runtimeGenerators: (raw.runtimeGenerators && typeof raw.runtimeGenerators === 'object')
        ? raw.runtimeGenerators
        : {}
    }
    const phpMetadata = supportedTypes.value.runtimeGenerators?.php
    form.phpMinimumVersion = phpMetadata?.minimumVersion || '5.6'
    form.phpOutputMode = phpMetadata?.defaultOutputMode || 'compact'
  } catch {
    showError('获取支持类型失败')
  }
}

const getObfuscationSteps = async () => {
  try {
    const resp = await getObfuscationStepsApi()
    obfuscationSteps.value = resp.data || []
  } catch {
    // 混淆步骤加载失败不阻断主流程，静默处理
  }
}

// 生成随机请求头
const generateRandomHeader = () => {
  const standardHeaders = ['User-Agent', 'Cookie']

  // 随机选择一个标准请求头名称
  const randomHeader = standardHeaders[Math.floor(Math.random() * standardHeaders.length)]
  form.headerName = randomHeader

  // 生成随机请求头值（16位随机字符串）
  const randomValue = Math.random().toString(36).substring(2, 18)
  form.headerValue = randomValue
}

const handleGenerateTypeChange = () => {
  // 切换生成类型时重置相关字段
  if (form.generateType === 'webshell') {
    form.shellType = 'JSP'
    form.protocol = 'http'
    form.serverType = ''
    form.serverVersion = ''
    form.packerType = ''
    form.headerName = ''
    form.headerValue = ''
    form.urlPattern = '/*'
    form.injectorClassName = ''
    form.shellClassName = ''
    form.isAbstractTranslet = false
    form.byPassJavaModule = false
    form.lambdaSuffix = false
    form.staticInitialize = false
    form.shrink = true
  } else {
    // 内存马：shellType 表示注入器形态，与 WebShell 的 JSP/JSPX 不同
    form.shellType = ''
    form.serverType = ''
    form.serverVersion = ''
    form.protocol = 'http'
    form.coreClassName = ''
    // 切换到内存马模式时自动生成随机请求头
    generateRandomHeader()
  }
  outputResult.value = ''
  memoryMetadata.value = null
  webMetadata.value = null

  if (monacoEditor.value) {
    toRaw(monacoEditor.value).setValue('')
  }
}

const setRuntime = (runtime) => {
  if (form.runtime === runtime) return
  form.runtime = runtime
  form.generateType = 'webshell'
  form.protocol = 'http'
  form.serverType = ''
  form.serverVersion = ''
  form.packerType = ''
  form.coreClassName = ''
  form.servletNamespace = 'auto'
  form.targetJavaVersion = 'auto'
  form.jspObfuscationSteps = []
  if (runtime === 'php') {
    form.shellType = 'PHP'
    const portable = Disguises.value.find((item) => item.disguiseId === 'inner_PHP_JSON_Base64_1.0.0')
      || availableDisguises.value[0]
    form.reqDisguiseId = portable?.disguiseId || ''
    form.respDisguiseId = portable?.disguiseId || ''
    const metadata = phpGeneratorMetadata.value
    form.phpMinimumVersion = metadata.minimumVersion || '5.6'
    form.phpOutputMode = metadata.defaultOutputMode || 'compact'
  } else {
    form.shellType = 'JSP'
    form.headerName = ''
    form.headerValue = ''
    const javaDisguise = Disguises.value.find((item) => item.disguiseId === 'inner_AESBin_1.0.0')
      || Disguises.value[0]
    form.reqDisguiseId = javaDisguise?.disguiseId || ''
    form.respDisguiseId = javaDisguise?.disguiseId || ''
  }
  outputResult.value = ''
  webMetadata.value = null
  memoryMetadata.value = null
  lastGeneratedForm.value = null
  if (monacoEditor.value) toRaw(monacoEditor.value).setValue('')
}

const setGenerateType = (type) => {
  if (isPhpRuntime.value) return
  if (form.generateType === type) return
  form.generateType = type
  handleGenerateTypeChange()
}

const handleServerTypeChange = () => {
  const injectorNames = availableInjectorShellTypes.value
  form.shellType = injectorNames.length === 1 ? injectorNames[0] : ''
  form.serverVersion = ''
  if (!injectorNamespaceCompatible.value) form.servletNamespace = 'javax'
}

const reconcileMemorySelections = () => {
  if (isPhpRuntime.value || form.generateType !== 'memoryshell') return
  reconcileMemoryProtocolSelection({
    form,
    serverInjectorTypes: protocolServerInjectorTypes.value,
    compatiblePackerNames: packerTypesFlat.value
  })
}

const handleProtocolChange = () => {
  if (form.protocol === 'websocket' && (!form.urlPattern || form.urlPattern === '/*')) {
    form.urlPattern = '/leo'
  } else if (form.protocol !== 'websocket' && form.urlPattern === '/leo') {
    form.urlPattern = '/*'
  }
  reconcileMemorySelections()
  if (!injectorNamespaceCompatible.value) form.servletNamespace = 'javax'
}

const reconcileInjectorCapability = () => {
  const capability = selectedInjectorCapability.value
  if (!capability) return
  if (capability.supportsStaticInitialize === false) form.staticInitialize = false
  if (capability.supportsUrlPattern === false) form.urlPattern = '/*'
  if (!capability.requiresServerVersion) {
    form.serverVersion = ''
  } else if (!capability.serverVersions?.includes(form.serverVersion)) {
    form.serverVersion = capability.serverVersions?.length === 1
      ? capability.serverVersions[0]
      : ''
  }
  if (Array.isArray(capability.supportedPackers)
      && capability.supportedPackers.length === 1
      && !capability.supportedPackers.includes(form.packerType)) {
    form.packerType = capability.supportedPackers[0]
  }
}

const getEditorLanguage = () => {
  if (isPhpRuntime.value) return 'php'
  // 输出区以“展示”为主，不需要类型校验，统一使用更稳的语言模式
  if (form.generateType === 'webshell') {
    // JSP/JSPX 用 html 更接近模板语法；其他情况退化为纯文本
    return form.shellType === 'JSP' || form.shellType === 'JSPX' ? 'html' : 'plaintext'
  }
  // 内存马返回 Packer 输出的 payload 字符串，纯文本展示
  return 'plaintext'
}

const initializeMonacoEditor = () => {
  try {
    if (!monacoContainer.value) return

    // 输出区只读展示，不需要 TS/JS 诊断能力
    if (monaco?.languages?.typescript) {
      monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: true
      })
      monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: true
      })
    }

    recreateEditorInstance(
      monacoEditor,
      monacoContainer,
      createMonacoEditorOptions({
        value: outputResult.value,
        language: getEditorLanguage(),
        theme: monacoTheme.value,
        readOnly: true,
        lineNumbers: 'off',
        glyphMargin: false,
        folding: false,
        lineDecorationsWidth: 0,
        lineNumbersMinChars: 0,
        contextmenu: false,
        wordWrap: 'on'
      })
    )
  } catch {
    // 静默处理编辑器初始化失败
  }
}

const handleEditorContainerReady = (container) => {
  monacoContainer.value = container
  if (container) {
    initializeMonacoEditor()
  }
}

const GenShell = async () => {
  try {
    const buildRequest = createBuildRequest(form, { isJspGroupPacker })
    const generators = {
      [BUILD_CHANNEL.RUNTIME]: generateRuntimeScriptApi,
      [BUILD_CHANNEL.WEB]: generateWebShellApi,
      [BUILD_CHANNEL.MEMORY]: generateMemoryShellApi
    }
    const resp = await generators[buildRequest.channel](buildRequest.params)
    const result = resp.data?.[buildRequest.resultKey] || ''

    if (buildRequest.channel === BUILD_CHANNEL.MEMORY) {
      memoryMetadata.value = resp.data || null
      webMetadata.value = null
    } else {
      webMetadata.value = resp.data || null
      memoryMetadata.value = null
    }

    outputResult.value = result
    await nextTick()

    // 快照当前配置，用于检测后续变更
    lastGeneratedForm.value = snapshotBuildForm(form)

    if (monacoEditor.value) {
      // 更新编辑器语言
      const language = getEditorLanguage()
      const model = toRaw(monacoEditor.value).getModel()
      if (model) {
        monaco.editor.setModelLanguage(model, language)
      }
      toRaw(monacoEditor.value).setValue(outputResult.value)
      toRaw(monacoEditor.value).layout()
    } else {
      initializeMonacoEditor()
    }

    showSuccess('脚本生成成功')
    const warnings = resp?.data?.compatibilityWarnings || resp?.data?.warnings
    if (Array.isArray(warnings) && warnings.length) {
      showWarning(warnings.join('；'))
    }
  } catch (error) {
    await getSupportedTypes()
    showError('生成脚本失败: ' + (error.message || '未知错误'))
  }
}

const writeTextToClipboard = async (text, successMessage = '已复制到剪贴板') => {
  try {
    await navigator.clipboard.writeText(text)
    showSuccess(successMessage)
  } catch {
    // 降级方案：使用传统方法
    try {
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      showSuccess(successMessage)
    } catch {
      showError('复制失败，请手动复制')
    }
  }
}

const downloadGeneratedClass = (artifact) => {
  try {
    const bytes = decodeClassArtifact(artifact)
    downloadBlob(
      new Blob([bytes], { type: artifact.mediaType || 'application/java-vm' }),
      artifact.fileName
    )
    showSuccess(`已下载 ${artifact.fileName}`)
  } catch (error) {
    showError(error.message || 'Class 产物下载失败')
  }
}

// 复制到剪贴板
const copyToClipboard = async () => {
  if (!outputResult.value) {
    showWarning('没有可复制的内容')
    return
  }

  await writeTextToClipboard(outputResult.value)
}

const copyConfigSummary = async () => {
  if (!configSummaryText.value) {
    showWarning('没有可复制的配置摘要')
    return
  }

  await writeTextToClipboard(configSummaryText.value, '配置摘要已复制')
}

const resolveArtifactExtension = () => {
  if (isPhpRuntime.value) return webMetadata.value?.fileExtension || 'php'
  if (form.generateType === 'memoryshell') {
    return isJspGroupPacker(form.packerType) ? 'jsp' : 'txt'
  }
  const extension = sanitizeArtifactName(webMetadata.value?.type || form.shellType, 'txt')
  return ['jsp', 'jspx', 'php', 'aspx', 'ashx'].includes(extension) ? extension : 'txt'
}

const buildArtifactName = () => {
  if (isPhpRuntime.value) return `http-php-${form.phpOutputMode || 'compact'}-webshell`
  if (form.generateType === 'memoryshell') {
    const server = sanitizeArtifactName(form.serverType, 'server')
    const shell = sanitizeArtifactName(form.shellType, 'shell')
    return `memory-${server}-${shell}`
  }
  const protocol = sanitizeArtifactName(form.protocol, 'http')
  const shell = sanitizeArtifactName(form.shellType, 'webshell')
  return `${protocol}-${shell}`
}

const saveArtifact = async () => {
  if (!outputResult.value) {
    showWarning('请先生成脚本')
    return
  }
  if (isResultStale.value) {
    showWarning('配置已变更，请重新生成后再保存成果')
    return
  }

  isSavingArtifact.value = true
  try {
    const artifact = await archiveTextArtifact({
      category: ARTIFACT_CATEGORY.SCRIPT_BUILDS,
      name: buildArtifactName(),
      extension: resolveArtifactExtension(),
      content: outputResult.value
    })
    showSuccess(`成果已保存至 ${artifact.path}`)
  } catch (error) {
    showError(`保存成果失败: ${error?.message || '未知错误'}`)
  } finally {
    isSavingArtifact.value = false
  }
}

const handleKeydown = (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    if (isFormValid.value) {
      e.preventDefault()
      GenShell()
    }
  }
}

watch(() => form.protocol, handleProtocolChange)
watch(selectedInjectorCapability, reconcileInjectorCapability)
watch(
  [protocolServerInjectorTypes, packerTypesFlat],
  reconcileMemorySelections,
  { deep: true }
)

// 跟随应用主题:与其它 Monaco 编辑器一致,主题切换时同步全局 Monaco 主题。
watchMonacoTheme(() => monacoEditor.value)

onMounted(() => {
  Promise.all([getAllDisguises(), getSupportedTypes(), getObfuscationSteps()]).catch(() => {
    showError('初始化数据失败')
  })
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  disposeEditorInstance(monacoEditor)
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.home-content {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.script-generator-page {
  --sg-blue: var(--el-color-primary);
  --sg-purple: #7a5af8;
  --sg-green: var(--el-color-success);
  --sg-ink: var(--el-text-color-primary);
  --sg-muted: var(--el-text-color-secondary);
  --sg-border: color-mix(in srgb, var(--el-border-color) 70%, transparent);
  --sg-panel-strong: var(--app-card-background);
  --sg-panel-soft: var(--app-control-background-soft);
  --sg-blue-soft: color-mix(in srgb, var(--sg-blue) 12%, var(--app-control-background));
  --sg-green-soft: color-mix(in srgb, var(--sg-green) 12%, var(--app-control-background));
}

:global(html.dark .script-generator-page),
:global(html[data-theme='dark'] .script-generator-page) {
  --sg-panel-strong: color-mix(in srgb, var(--app-card-background) 94%, var(--el-bg-color-overlay));
  --sg-panel-soft: color-mix(
    in srgb,
    var(--app-control-background-soft) 86%,
    var(--app-card-background)
  );
  --sg-blue-soft: color-mix(in srgb, var(--sg-blue) 18%, var(--app-control-background));
  --sg-green-soft: color-mix(in srgb, var(--sg-green) 16%, var(--app-control-background));
}

.script-workbench {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--app-layout-gap);
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.content-split {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(420px, 520px) minmax(0, 1fr);
  gap: var(--app-layout-gap);
  overflow: hidden;
}

.content-split > :deep(section) {
  box-shadow: none;
}

@media (max-width: 1500px) {
  .content-split {
    grid-template-columns: minmax(390px, 480px) minmax(0, 1fr);
  }
}

@media (max-width: 1220px) {
  .content-split {
    grid-template-columns: 1fr;
    overflow: auto;
  }
}

@media (max-width: 760px) {
  .script-workbench {
    padding: 0;
  }
}
</style>
