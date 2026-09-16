<template>
  <div class="port-policy-selector">
    <div class="policy-heading">
      <strong>端口范围</strong><span class="policy-summary">{{ localPolicy.preset === 'CUSTOM' ? totalPortCount.toLocaleString('zh-CN') + ' 个端口' : presets.find(item => item.value === localPolicy.preset)?.portCount }}</span>
    </div>
    <el-radio-group
      v-model="localPolicy.preset"
      class="preset-grid"
      @change="handlePresetChange"
    >
      <el-radio-button
        v-for="preset in presets"
        :key="preset.value"
        :value="preset.value"
      >
        <span class="preset-option"><strong>{{ preset.label }}</strong><small>{{ preset.portCount }}</small></span>
      </el-radio-button>
    </el-radio-group>

    <div
      v-if="localPolicy.preset === 'CUSTOM'"
      class="custom-panel"
    >
      <div class="custom-heading">
        <strong>自定义端口</strong><el-button
          v-if="totalPortCount || localPolicy.excludePorts.length"
          text
          size="small"
          @click="clearCustom"
        >
          清空自定义
        </el-button>
      </div>
      <div
        class="port-groups"
        aria-label="常用端口组"
      >
        <button
          v-for="group in portGroups"
          :key="group.value"
          type="button"
          class="group-chip"
          :class="{ selected: isGroupSelected(group), partial: isGroupPartial(group) }"
          :aria-pressed="isGroupSelected(group)"
          @click="toggleGroup(group)"
        >
          <span>{{ group.label }}</span><small>{{ group.ports.length }}</small>
        </button>
      </div>
      <div class="custom-fields">
        <div class="custom-field">
          <label for="include-ports">包含端口</label><el-input
            id="include-ports"
            v-model="customPortsText"
            placeholder="80, 443, 8000-9000"
            @input="parseCustomPorts"
          />
        </div>
        <div class="custom-field">
          <label for="exclude-ports">排除端口</label><el-input
            id="exclude-ports"
            v-model="excludePortsText"
            placeholder="例如：22, 23"
            @input="parseExcludePorts"
          />
        </div>
      </div>
      <details class="range-editor">
        <summary>添加连续范围</summary>
        <div class="range-row">
          <el-input-number
            v-model="rangeStart"
            aria-label="起始端口"
            :min="1"
            :max="65535"
            controls-position="right"
          /><span>至</span><el-input-number
            v-model="rangeEnd"
            aria-label="结束端口"
            :min="1"
            :max="65535"
            controls-position="right"
          /><el-button
            size="small"
            plain
            @click="addRange"
          >
            添加范围
          </el-button>
        </div>
      </details>
      <div
        v-if="portRanges.length"
        class="range-tags"
      >
        <el-tag
          v-for="(range, index) in portRanges"
          :key="range.start + '-' + range.end + '-' + index"
          closable
          size="small"
          @close="removeRange(index)"
        >
          {{ range.start }}-{{ range.end }}
        </el-tag>
      </div>
      <p
        v-if="parseError"
        class="parse-error"
      >
        {{ parseError }}
      </p>
      <div class="port-summary">
        <span>本次包含</span><div class="summary-values">
          <el-tag
            v-for="port in previewPorts"
            :key="port"
            size="small"
          >
            {{ port }}
          </el-tag><span
            v-if="totalPortCount > previewPorts.length"
            class="summary-more"
          >+{{ totalPortCount - previewPorts.length }} 个</span><span
            v-if="!totalPortCount"
            class="summary-empty"
          >尚未选择端口</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({ preset: 'QUICK', customPorts: [], excludePorts: [] })
  }
})

const emit = defineEmits(['update:modelValue'])

const presets = [
  { value: 'QUICK', label: '快速', portCount: '约 100 端口' },
  { value: 'STANDARD', label: '标准', portCount: '约 1,000 端口' },
  { value: 'EXTENDED', label: '扩展', portCount: '约 5,000 端口' },
  { value: 'CUSTOM', label: '自定义', portCount: '按需选择' }
]

const portGroups = [
  { value: 'web', label: 'Web', ports: [80, 443, 8000, 8080, 8443, 8888] },
  { value: 'database', label: '数据库', ports: [1433, 1521, 3306, 5432, 6379, 27017] },
  { value: 'remote', label: '远程管理', ports: [22, 23, 3389, 5900, 5901] },
  { value: 'file', label: '文件传输', ports: [20, 21, 69, 139, 445, 873, 2049] },
  { value: 'mail', label: '邮件', ports: [25, 110, 143, 465, 587, 993, 995] },
  { value: 'middleware', label: '中间件', ports: [2181, 5601, 7001, 9090, 9092, 9200] }
]

const initialPorts = normalizePorts(props.modelValue?.customPorts)
const localPolicy = reactive({
  preset: props.modelValue?.preset || 'QUICK',
  excludePorts: normalizePorts(props.modelValue?.excludePorts)
})
const selectedPorts = ref(initialPorts)
const customPortsText = ref(initialPorts.join(', '))
const excludePortsText = ref(localPolicy.excludePorts.join(', '))
const manualPorts = ref([])
const parseError = ref('')
const rangeStart = ref(1)
const rangeEnd = ref(1000)
const portRanges = ref([])

const allSelectedPorts = computed(() => {
  const ports = new Set([...selectedPorts.value, ...manualPorts.value])
  portRanges.value.forEach(range => {
    for (let port = range.start; port <= range.end; port += 1) ports.add(port)
  })
  localPolicy.excludePorts.forEach(port => ports.delete(port))
  return Array.from(ports).sort((left, right) => left - right)
})
const totalPortCount = computed(() => localPolicy.preset === 'CUSTOM' ? allSelectedPorts.value.length : 0)
const previewPorts = computed(() => allSelectedPorts.value.slice(0, 8))

watch(
  [() => localPolicy.preset, () => localPolicy.excludePorts, selectedPorts, manualPorts, portRanges],
  emitPolicy,
  { deep: true }
)

function normalizePorts(value) {
  return Array.from(new Set((Array.isArray(value) ? value : []).map(Number).filter(port => Number.isInteger(port) && port >= 1 && port <= 65535))).sort((left, right) => left - right)
}

function emitPolicy() {
  emit('update:modelValue', {
    preset: localPolicy.preset,
    customPorts: allSelectedPorts.value,
    excludePorts: [...localPolicy.excludePorts]
  })
}

function handlePresetChange() {
  emitPolicy()
}

function isGroupSelected(group) {
  return group.ports.every(port => selectedPorts.value.includes(port))
}

function isGroupPartial(group) {
  const selected = group.ports.filter(port => selectedPorts.value.includes(port)).length
  return selected > 0 && selected < group.ports.length
}

function toggleGroup(group) {
  const groupPorts = new Set(group.ports)
  if (isGroupSelected(group)) {
    selectedPorts.value = selectedPorts.value.filter(port => !groupPorts.has(port))
  } else {
    selectedPorts.value = normalizePorts([...selectedPorts.value, ...group.ports])
  }
}

function parseCustomPorts() {
  try {
    manualPorts.value = parsePortString(customPortsText.value)
    parseError.value = ''
  } catch (error) {
    manualPorts.value = []
    parseError.value = error.message
  }
}

function parseExcludePorts() {
  try {
    localPolicy.excludePorts = parsePortString(excludePortsText.value)
    parseError.value = ''
  } catch (error) {
    parseError.value = error.message
  }
}

function parsePortString(value) {
  if (!String(value || '').trim()) return []
  const ports = new Set()
  const parts = String(value).split(/[\s,]+/).filter(Boolean)
  for (const part of parts) {
    if (/^\d+$/.test(part)) {
      const port = Number(part)
      if (port < 1 || port > 65535) throw new Error(`端口 ${port} 超出范围`)
      ports.add(port)
      continue
    }
    if (/^\d+-\d+$/.test(part)) {
      const [start, end] = part.split('-').map(Number)
      if (start < 1 || end > 65535 || start > end) throw new Error(`端口范围 ${part} 无效`)
      for (let port = start; port <= end; port += 1) ports.add(port)
      continue
    }
    throw new Error(`无法解析：${part}`)
  }
  return Array.from(ports).sort((left, right) => left - right)
}

function addRange() {
  if (rangeStart.value > rangeEnd.value) {
    ElMessage.error('起始端口不能大于结束端口')
    return
  }
  const next = { start: rangeStart.value, end: rangeEnd.value }
  if (!portRanges.value.some(range => range.start === next.start && range.end === next.end)) portRanges.value.push(next)
}

function removeRange(index) {
  portRanges.value.splice(index, 1)
}

function clearCustom() {
  selectedPorts.value = []
  manualPorts.value = []
  customPortsText.value = ''
  excludePortsText.value = ''
  localPolicy.excludePorts = []
  portRanges.value = []
  parseError.value = ''
}
</script>

<style scoped lang="scss">
.port-policy-selector { min-width: 0; color: var(--el-text-color-primary); }
.policy-heading, .custom-heading, .port-summary { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.policy-heading { margin-bottom: 8px; }
.policy-heading strong, .custom-heading strong { font-size: 12px; font-weight: 600; }
.policy-summary { color: var(--el-text-color-secondary); font-size: 11px; white-space: nowrap; }
.preset-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); width: 100%; }
.preset-grid :deep(.el-radio-button), .preset-grid :deep(.el-radio-button__inner) { width: 100%; }
.preset-grid :deep(.el-radio-button__inner) { padding: 10px 4px; }
.preset-grid :deep(.el-radio-button.is-active .el-radio-button__inner) { color: var(--el-color-primary); background: var(--el-color-primary-light-9); border-color: var(--el-color-primary); }
.preset-option { display: flex; align-items: center; flex-direction: column; gap: 5px; }
.preset-option strong { font-size: 12px; font-weight: 600; }
.preset-option small { color: var(--el-text-color-secondary); font-size: 10px; }
.preset-grid :deep(.el-radio-button.is-active small) { color: var(--el-color-primary); }
.custom-panel { margin-top: 12px; }
.custom-heading { min-height: 24px; margin-bottom: 8px; }
.port-groups { display: flex; flex-wrap: wrap; gap: 6px; }
.group-chip { display: inline-flex; align-items: center; gap: 5px; padding: 5px 8px; border: 1px solid var(--el-border-color); border-radius: 4px; color: var(--el-text-color-regular); background: var(--el-fill-color-blank); cursor: pointer; font-size: 11px; }
.group-chip small { color: var(--el-text-color-secondary); font-size: 10px; }
.group-chip:hover, .group-chip.partial { border-color: var(--el-color-primary-light-5); color: var(--el-color-primary); }
.group-chip.selected { border-color: var(--el-color-primary); color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
.group-chip.selected small, .group-chip.partial small { color: inherit; }
.group-chip:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: 2px; }
.custom-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }
.custom-field label { display: block; margin-bottom: 6px; color: var(--el-text-color-regular); font-size: 11px; }
.custom-field :deep(.el-input__inner) { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; line-height: 1.5; }
.range-editor { margin-top: 10px; }
.range-editor summary { color: var(--el-text-color-secondary); cursor: pointer; font-size: 11px; }
.range-editor summary:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: 3px; }
.range-row { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.range-row > span { color: var(--el-text-color-secondary); font-size: 11px; }
.range-row :deep(.el-input-number) { flex: 1; min-width: 70px; width: 90px; }
.range-tags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
.parse-error { margin: 8px 0 0; color: var(--el-color-danger); font-size: 11px; }
.port-summary { align-items: flex-start; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--el-border-color-lighter); }
.port-summary > span { flex-shrink: 0; padding-top: 3px; color: var(--el-text-color-secondary); font-size: 11px; }
.summary-values { display: flex; flex: 1; flex-wrap: wrap; gap: 5px; min-width: 0; }
.summary-values :deep(.el-tag) { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.summary-more, .summary-empty { padding-top: 3px; color: var(--el-text-color-secondary); font-size: 10px; }
</style>
