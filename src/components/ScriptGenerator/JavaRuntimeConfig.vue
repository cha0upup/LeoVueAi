<template>
  <div class="java-runtime-config">
    <section class="java-strategy form-group">
      <div class="group-heading">
        <strong>Java 构建策略</strong>
      </div>
      <div class="form-grid">
        <el-form-item
          label="目标 JDK"
          required
        >
          <el-select
            v-model="form.targetJavaVersion"
            @change="handleTargetJavaVersionChange"
          >
            <el-option
              v-for="version in targetJavaVersions"
              :key="version"
              :label="targetJavaLabel(version)"
              :value="version"
            />
          </el-select>
        </el-form-item>
      </div>
      <div
        v-if="compatibilityMessage"
        class="compatibility-note"
        :class="`is-${compatibilityTone}`"
      >
        <Icon :icon="compatibilityTone === 'warning' ? iconMap.warning : iconMap.info" />
        {{ compatibilityMessage }}
      </div>
    </section>

    <section
      v-if="form.generateType === 'webshell'"
      class="form-group"
    >
      <div class="group-heading">
        <strong>WebShell 载体</strong>
      </div>
      <div class="option-grid">
        <button
          v-for="type in ['JSP', 'JSPX']"
          :key="type"
          type="button"
          class="strategy-option"
          :class="{ active: form.shellType === type }"
          @click="form.shellType = type"
        >
          <strong>{{ type }}</strong>
          <small>{{ type === 'JSP' ? '标准脚本页' : 'XML 文档格式' }}</small>
        </button>
      </div>
      <div class="field-label">
        传输协议
      </div>
      <div class="protocol-grid">
        <button
          v-for="item in protocolOptions"
          :key="item.value"
          type="button"
          :class="{ active: form.protocol === item.value }"
          @click="form.protocol = item.value"
        >
          <strong>{{ item.label }}</strong>
          <small>{{ item.description }}</small>
        </button>
      </div>
    </section>

    <section
      v-else
      class="form-group"
    >
      <div class="group-heading">
        <strong>宿主与装载策略</strong>
      </div>
      <div class="field-label">
        传输协议
      </div>
      <div class="protocol-grid">
        <button
          v-for="item in protocolOptions"
          :key="item.value"
          type="button"
          :class="{ active: form.protocol === item.value }"
          @click="form.protocol = item.value"
        >
          <strong>{{ item.label }}</strong>
          <small>{{ item.description }}</small>
        </button>
      </div>
      <div class="form-grid">
        <el-form-item
          label="应用服务器"
          required
        >
          <el-select
            v-model="form.serverType"
            placeholder="选择宿主类型"
            clearable
            filterable
            @change="emit('server-type-change')"
          >
            <el-option
              v-for="server in serverTypes"
              :key="server"
              :label="server"
              :value="server"
            />
          </el-select>
        </el-form-item>
        <el-form-item
          label="注入器类型"
          required
        >
          <el-select
            v-model="form.shellType"
            placeholder="选择注入器"
            clearable
            filterable
            :disabled="!form.serverType"
            @change="handleInjectorChange"
          >
            <el-option
              v-for="name in availableInjectorShellTypes"
              :key="name"
              :label="injectorLabel(name)"
              :value="name"
            />
          </el-select>
        </el-form-item>
        <el-form-item
          v-if="selectedInjectorCapability?.requiresServerVersion"
          label="服务器版本"
          required
        >
          <el-select
            v-model="form.serverVersion"
            placeholder="选择目标主版本"
          >
            <el-option
              v-for="version in selectedInjectorCapability.serverVersions"
              :key="version"
              :label="`${form.serverType} ${version}`"
              :value="version"
            />
          </el-select>
        </el-form-item>
        <el-form-item
          class="span-2"
          label="打包器 Packer"
          required
        >
          <el-select
            v-model="form.packerType"
            placeholder="按分组选择打包器"
            clearable
            filterable
          >
            <el-option-group
              v-for="group in packerTypesStructure.groups"
              :key="group.groupName"
              :label="group.groupName"
            >
              <el-option
                v-for="packer in group.packers"
                :key="group.groupName + ':' + packer"
                :label="packerLabel(packer)"
                :value="packer"
                :disabled="!isPackerCompatible(packer)"
              />
            </el-option-group>
            <el-option-group
              v-if="packerTypesStructure.ungrouped.length"
              label="其他"
            >
              <el-option
                v-for="packer in packerTypesStructure.ungrouped"
                :key="'ug:' + packer"
                :label="packerLabel(packer)"
                :value="packer"
                :disabled="!isPackerCompatible(packer)"
              />
            </el-option-group>
            <template v-if="!packerTypesStructure.groups.length && !packerTypesStructure.ungrouped.length">
              <el-option
                v-for="packer in packerTypesFlat"
                :key="packer"
                :label="packerLabel(packer)"
                :value="packer"
                :disabled="!isPackerCompatible(packer)"
              />
            </template>
          </el-select>
        </el-form-item>
      </div>
    </section>

    <section
      v-if="form.generateType === 'memoryshell'"
      class="form-group header-gate-panel"
    >
      <div class="group-heading">
        <strong>{{ form.protocol === 'websocket' ? 'WebSocket 查询门禁' : 'Header 门禁' }}</strong>
        <button
          v-if="selectedInjectorCapability?.supportsHeaderGate !== false"
          class="random-button"
          type="button"
          @click="emit('generate-random-header')"
        >
          <Icon :icon="iconMap.refresh" />
          随机
        </button>
      </div>
      <div
        v-if="selectedInjectorCapability?.supportsHeaderGate !== false"
        class="header-pair"
      >
        <el-input
          v-model="form.headerName"
          :placeholder="form.protocol === 'websocket' ? '查询参数名，如 token' : 'Header 名，如 X-Token'"
        />
        <span>:</span>
        <el-input
          v-model="form.headerValue"
          :placeholder="form.protocol === 'websocket' ? '查询参数值' : 'Header 值'"
        />
      </div>
    </section>

    <slot />

    <details class="advanced-card form-group">
      <summary>
        <span>
          <strong>高级配置</strong>
          <small>类名、Servlet API、模块兼容等低频选项</small>
        </span>
        <Icon :icon="iconMap.arrowDown" />
      </summary>
      <div class="form-grid advanced-grid">
        <el-form-item label="核心类名">
          <el-input
            v-model="form.coreClassName"
            placeholder="随机"
          />
        </el-form-item>
        <template v-if="form.generateType === 'memoryshell'">
          <el-form-item label="注入器类名">
            <el-input
              v-model="form.injectorClassName"
              placeholder="随机"
            />
          </el-form-item>
          <el-form-item label="Shell 类名">
            <el-input
              v-model="form.shellClassName"
              placeholder="随机"
            />
          </el-form-item>
          <el-form-item
            label="Servlet API"
            required
          >
            <el-select v-model="form.servletNamespace">
              <el-option
                v-for="namespace in servletNamespaces"
                :key="namespace"
                :label="servletNamespaceLabel(namespace)"
                :value="namespace"
                :disabled="!isServletNamespaceCompatible(namespace, form.targetJavaVersion) || !isInjectorNamespaceCompatible(namespace)"
              />
            </el-select>
          </el-form-item>
          <el-form-item
            v-if="selectedInjectorCapability?.supportsUrlPattern !== false"
            :label="form.protocol === 'websocket' ? 'Endpoint 路径' : 'URL 匹配范围'"
          >
            <el-input
              v-model="form.urlPattern"
              :placeholder="form.protocol === 'websocket' ? '例如 /leo，不支持通配符' : '默认 /*'"
            />
          </el-form-item>
          <div class="switch-options">
            <label title="部分 TemplatesImpl/Translet 载体要求继承 AbstractTranslet"><span>AbstractTranslet</span><el-switch v-model="form.isAbstractTranslet" /></label>
            <label title="JDK 9+ 会自动生效，并在 Injector 构造入口执行模块兼容逻辑"><span>Java Module 兼容</span><el-switch v-model="form.byPassJavaModule" /></label>
            <label title="为 Shell 与 Injector 追加 $Proxy0$$Lambda$1"><span>Lambda 类名后缀</span><el-switch v-model="form.lambdaSuffix" /></label>
            <label
              v-if="selectedInjectorCapability?.supportsStaticInitialize !== false"
              title="在类初始化阶段自动调用 Injector 无参构造器"
            ><span>静态初始化挂载</span><el-switch v-model="form.staticInitialize" /></label>
            <label title="移除调试属性、注解与无关类元数据"><span>Class 瘦身</span><el-switch v-model="form.shrink" /></label>
          </div>
        </template>
      </div>
    </details>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { icons } from '@/utils/icons.js'
import {
  getPackerCompatibilityWarning,
  isPackerTargetCompatible,
  isServletNamespaceCompatible
} from './scriptGeneratorCompatibility.js'

const iconMap = icons
const form = defineModel('form', { type: Object, required: true })
const props = defineProps({
  serverTypes: { type: Array, default: () => [] },
  availableInjectorShellTypes: { type: Array, default: () => [] },
  injectorCapabilities: { type: Array, default: () => [] },
  packerTypesStructure: { type: Object, required: true },
  packerTypesFlat: { type: Array, default: () => [] },
  targetJavaVersions: { type: Array, default: () => ['auto', '6', '7', '8', '9+', '17+'] },
  packerCompatibility: { type: Object, default: () => ({}) },
  servletNamespaces: { type: Array, default: () => ['auto', 'javax', 'jakarta'] },
  transportProtocols: {
    type: Object,
    default: () => ({
      webshell: ['http', 'httpchunk'],
      memoryshell: ['http', 'httpchunk', 'websocket']
    })
  }
})
const emit = defineEmits(['server-type-change', 'generate-random-header'])

const protocolMetadata = Object.freeze({
  http: { value: 'http', label: 'HTTP', description: '标准请求响应' },
  httpchunk: { value: 'httpchunk', label: 'HTTP Chunk', description: '持久分帧连接' },
  websocket: { value: 'websocket', label: 'WebSocket', description: 'WebSocket 连接' }
})
const protocolOptions = computed(() => {
  const key = form.value.generateType === 'memoryshell' ? 'memoryshell' : 'webshell'
  const protocols = Array.isArray(props.transportProtocols?.[key])
    ? props.transportProtocols[key]
    : []
  return protocols.map(protocol => protocolMetadata[protocol]).filter(Boolean)
})
const targetJavaLabel = version => version === 'auto' ? 'JDK 自动兼容' : `JDK ${version}`
const servletNamespaceLabel = namespace => {
  if (namespace === 'auto') return '自动（javax）'
  return namespace === 'jakarta' ? 'Jakarta Servlet' : 'Javax Servlet'
}
const isPackerCompatible = packer => {
  const supported = selectedInjectorCapability.value?.supportedPackers
  const injectorAllowsPacker = !Array.isArray(supported)
    || (supported.length === 0 && packer !== 'AgentJarBase64')
    || supported.includes(packer)
  return injectorAllowsPacker && isPackerTargetCompatible(
    props.packerCompatibility?.[packer], form.value.targetJavaVersion
  )
}
const packerLabel = packer => {
  if (props.packerCompatibility?.[packer]?.status === 'failed') return `${packer} · 不可用`
  const minimum = Number(props.packerCompatibility?.[packer]?.minTargetJava || 6)
  return minimum > 6 ? `${packer} · JDK ${minimum}+` : packer
}
const injectorLabel = name => {
  const descriptor = props.injectorCapabilities.find(item =>
    item?.serverType === form.value.serverType
      && item?.protocol === form.value.protocol
      && item?.injectorName === name
  )
  return descriptor?.mountLabel ? `${name} · ${descriptor.mountLabel}` : name
}
const packerWarning = computed(() => {
  if (form.value.generateType !== 'memoryshell' || !form.value.packerType) return ''
  const metadata = props.packerCompatibility?.[form.value.packerType]
  if (metadata?.status === 'failed') return `该 Packer 初始化失败：${metadata.failureReason || '未知原因'}`
  return getPackerCompatibilityWarning(metadata, form.value.targetJavaVersion)
})
const servletWarning = computed(() => {
  if (form.value.generateType !== 'memoryshell') return ''
  if (!isInjectorNamespaceCompatible(form.value.servletNamespace)) {
    return `${form.value.serverType} / ${form.value.shellType} 仅支持 Javax Servlet`
  }
  if (form.value.servletNamespace === 'auto') {
    return '自动模式生成 javax.servlet；Tomcat 10+、Jetty 11+ 或 Spring 6 请选择 Jakarta Servlet'
  }
  if (form.value.servletNamespace === 'jakarta' && form.value.targetJavaVersion === 'auto') {
    return 'Jakarta Servlet 需要 JDK 8+，建议明确目标 JDK'
  }
  return ''
})
const moduleCompatibilityNote = computed(() => {
  if (form.value.generateType !== 'memoryshell') return ''
  const major = Number.parseInt(form.value.targetJavaVersion, 10)
  return Number.isFinite(major) && major >= 9
    ? '目标为 JDK 9+：Injector 与 Packer 已自动启用 Java Module 兼容'
    : ''
})
const selectedInjectorCapability = computed(() => props.injectorCapabilities.find(item =>
  item?.serverType === form.value.serverType
    && item?.protocol === form.value.protocol
    && item?.injectorName === form.value.shellType
))
const isInjectorNamespaceCompatible = namespace => {
  const resolved = namespace === 'auto' ? 'javax' : namespace
  const supported = selectedInjectorCapability.value?.servletNamespaces
  return !Array.isArray(supported) || supported.includes(resolved)
}
const handleInjectorChange = () => {
  const versions = selectedInjectorCapability.value?.serverVersions
  if (!selectedInjectorCapability.value?.requiresServerVersion) {
    form.value.serverVersion = ''
  } else if (!Array.isArray(versions) || !versions.includes(form.value.serverVersion)) {
    form.value.serverVersion = versions?.length === 1 ? versions[0] : ''
  }
  const supportedPackers = selectedInjectorCapability.value?.supportedPackers
  if (Array.isArray(supportedPackers) && supportedPackers.length > 0
      && !supportedPackers.includes(form.value.packerType)) {
    form.value.packerType = supportedPackers.length === 1 ? supportedPackers[0] : ''
  }
  if (selectedInjectorCapability.value?.supportsStaticInitialize === false) {
    form.value.staticInitialize = false
  }
  if (selectedInjectorCapability.value?.supportsUrlPattern === false) {
    form.value.urlPattern = '/*'
  }
}
const compatibilityMessage = computed(() => packerWarning.value || servletWarning.value || moduleCompatibilityNote.value)
const compatibilityTone = computed(() => packerWarning.value || servletWarning.value
  ? 'warning'
  : 'info')

const handleTargetJavaVersionChange = () => {
  if (form.value.packerType && !isPackerCompatible(form.value.packerType)) form.value.packerType = ''
  const target = form.value.targetJavaVersion
  if (target !== 'auto' && Number.parseInt(target, 10) < 9) form.value.byPassJavaModule = false
  if (!isServletNamespaceCompatible(form.value.servletNamespace, target)) form.value.servletNamespace = 'javax'
  if (!isInjectorNamespaceCompatible(form.value.servletNamespace)) form.value.servletNamespace = 'javax'
}
</script>

<style scoped>
.java-runtime-config { display: contents; }
.form-group { padding: 10px 0 12px; border-top: 1px solid color-mix(in srgb, var(--el-border-color) 18%, transparent); }
.group-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 9px; }
.group-heading strong { color: var(--sg-ink); font-size: 12px; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px 10px; }
.span-2 { grid-column: 1 / -1; }
.compatibility-note { display: flex; align-items: flex-start; gap: 6px; margin-top: 8px; padding: 6px 7px; border-radius: 6px; background: color-mix(in srgb, var(--sg-blue) 8%, var(--sg-panel-strong)); color: var(--sg-muted); font-size: 8px; line-height: 1.4; }
.compatibility-note.is-warning { background: color-mix(in srgb, var(--el-color-warning) 10%, var(--sg-panel-strong)); color: var(--el-color-warning); }
.option-grid, .protocol-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; margin-bottom: 10px; }
.strategy-option, .protocol-grid button { min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 8px 9px; border: 1px solid var(--sg-border); border-radius: 8px; background: var(--sg-panel-strong); color: var(--sg-ink); text-align: left; cursor: pointer; }
.strategy-option.active, .protocol-grid button.active { border-color: var(--sg-blue); background: var(--sg-blue-soft); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sg-blue) 20%, transparent); }
.strategy-option strong, .protocol-grid strong { color: var(--sg-blue); font-size: 10px; }
.strategy-option small, .protocol-grid small { color: var(--sg-muted); font-size: 8px; }
.field-label { margin-bottom: 6px; color: var(--sg-muted); font-size: 10px; font-weight: 600; }
.header-pair { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 7px; margin-bottom: 9px; }
.header-pair > span { color: var(--sg-muted); font-weight: 700; }
.random-button { height: 25px; display: inline-flex; align-items: center; gap: 4px; padding: 0 8px; border: 1px solid var(--sg-border); border-radius: 7px; background: var(--sg-panel-strong); color: var(--sg-blue); font-size: 9px; cursor: pointer; }
.advanced-card { border-bottom: 0; }
.advanced-card summary { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 9px; border: 1px solid var(--sg-border); border-radius: 8px; background: var(--sg-panel-soft); cursor: pointer; list-style: none; }
.advanced-card summary::-webkit-details-marker { display: none; }
.advanced-card summary > span { display: flex; flex-direction: column; gap: 2px; }
.advanced-card summary strong { font-size: 10px; }
.advanced-card summary small { color: var(--sg-muted); font-size: 8px; }
.advanced-card[open] summary { margin-bottom: 9px; }
.advanced-card[open] summary > svg { transform: rotate(180deg); }
.advanced-grid { padding: 0 2px; }
.switch-options { display: flex; flex-direction: column; justify-content: center; gap: 7px; }
.switch-options label { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: var(--sg-muted); font-size: 9px; }
@media (max-width: 760px) {
  .form-grid, .option-grid, .protocol-grid, .header-pair { grid-template-columns: 1fr; }
}
</style>
