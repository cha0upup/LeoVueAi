<template>
  <div class="port-policy-selector">
    <div class="policy-heading"><strong>端口范围</strong><span class="policy-summary">{{ localPolicy.preset === 'CUSTOM' ? totalPortCount.toLocaleString('zh-CN') + ' 个端口' : presets.find(item => item.value === localPolicy.preset)?.portCount }}</span></div>
    <el-radio-group v-model="localPolicy.preset" class="preset-grid" @change="handlePresetChange">
      <el-radio-button v-for="preset in presets" :key="preset.value" :label="preset.value">
        <span class="preset-option"><strong>{{ preset.label }}</strong><small>{{ preset.portCount }}</small></span>
      </el-radio-button>
    </el-radio-group>

    <div v-if="localPolicy.preset === 'CUSTOM'" class="custom-panel">
      <div class="custom-heading"><strong>自定义端口</strong><el-button v-if="totalPortCount || localPolicy.excludePorts.length" text size="small" @click="clearCustom">清空自定义</el-button></div>
      <div class="port-groups" aria-label="常用端口组">
        <button v-for="group in portGroups" :key="group.value" type="button" class="group-chip" :class="{ selected: isGroupSelected(group), partial: isGroupPartial(group) }" :aria-pressed="isGroupSelected(group)" @click="toggleGroup(group)">
          <span>{{ group.label }}</span><small>{{ group.ports.length }}</small>
        </button>
      </div>
      <div class="custom-fields">
        <div class="custom-field"><label for="include-ports">包含端口</label><el-input id="include-ports" v-model="customPortsText" type="textarea" :rows="3" resize="none" placeholder="80, 443, 8000-9000" @input="parseCustomPorts" /></div>
        <div class="custom-field"><label for="exclude-ports">排除端口</label><el-input id="exclude-ports" v-model="excludePortsText" type="textarea" :rows="3" resize="none" placeholder="例如：22, 23" @input="parseExcludePorts" /></div>
      </div>
      <div class="range-row">
        <label>添加连续范围</label><el-input-number v-model="rangeStart" :min="1" :max="65535" controls-position="right" /><span>至</span><el-input-number v-model="rangeEnd" :min="1" :max="65535" controls-position="right" /><el-button size="small" plain @click="addRange">添加范围</el-button>
      </div>
      <div v-if="portRanges.length" class="range-tags"><el-tag v-for="(range, index) in portRanges" :key="range.start + '-' + range.end + '-' + index" closable size="small" @close="removeRange(index)">{{ range.start }}-{{ range.end }}</el-tag></div>
      <p v-if="parseError" class="parse-error">{{ parseError }}</p>
      <div class="port-summary"><span>本次包含</span><div class="summary-values"><el-tag v-for="port in previewPorts" :key="port" size="small">{{ port }}</el-tag><span v-if="totalPortCount > previewPorts.length" class="summary-more">+{{ totalPortCount - previewPorts.length }} 个</span><span v-if="!totalPortCount" class="summary-empty">尚未选择端口</span></div></div>
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
const previewPorts = computed(() => allSelectedPorts.value.slice(0, 24))

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
.port-policy-selector { color: #374151; }
.policy-heading, .policy-heading > div, .custom-heading, .custom-heading > div, .port-summary { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.policy-heading { margin-bottom: 10px; }
.policy-heading > div, .custom-heading > div { align-items: flex-start; flex-direction: column; gap: 3px; }
.policy-heading strong, .custom-heading strong { font-size: 12px; font-weight: 650; }
.policy-heading span, .custom-heading span { color: #9ca3af; font-size: 10px; font-weight: 400; }
.policy-summary { color: #2563eb !important; white-space: nowrap; }
.preset-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); width: 100%; }
.preset-grid :deep(.el-radio-button), .preset-grid :deep(.el-radio-button__inner) { width: 100%; }
.preset-grid :deep(.el-radio-button__inner) { min-height: 58px; padding: 9px 6px; }
.preset-option { display: flex; align-items: center; flex-direction: column; gap: 4px; }
.preset-option strong { font-size: 13px; font-weight: 650; }
.preset-option small { color: #9ca3af; font-size: 10px; }
.custom-panel { margin-top: 18px; padding-top: 16px; border-top: 1px solid #eef0f2; }
.custom-heading { align-items: flex-start; margin-bottom: 13px; }
.port-groups { display: flex; flex-wrap: wrap; gap: 7px; }
.group-chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 9px; border: 1px solid #d8e0e8; border-radius: 5px; color: #596875; background: #fff; cursor: pointer; font-size: 11px; transition: border-color .16s, color .16s, background .16s; }
.group-chip small { color: #9ca3af; font-size: 10px; }
.group-chip:hover, .group-chip.partial { border-color: #9dbcf8; color: #1d4ed8; }
.group-chip.selected { border-color: #8db0f5; color: #1d4ed8; background: #eef4ff; }
.group-chip.selected small, .group-chip.partial small { color: inherit; }
.custom-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 14px; }
.custom-field label, .range-row label { display: block; margin-bottom: 6px; color: #667481; font-size: 11px; font-weight: 600; }
.custom-field :deep(.el-textarea__inner) { min-height: 70px !important; padding: 8px 10px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; line-height: 1.5; }
.range-row { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; margin-top: 14px; }
.range-row label { margin: 0 5px 0 0; }
.range-row > span { color: #9ca3af; font-size: 11px; }
.range-row :deep(.el-input-number) { width: 112px; }
.range-tags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 9px; }
.parse-error { margin: 10px 0 0; color: #b91c1c; font-size: 11px; }
.port-summary { align-items: flex-start; margin-top: 14px; padding: 10px 0 0; border-top: 1px solid #eef0f2; }
.port-summary > span { flex: 0 0 auto; padding-top: 3px; color: #667481; font-size: 11px; font-weight: 600; }
.summary-values { display: flex; flex: 1; flex-wrap: wrap; gap: 5px; min-width: 0; }
.summary-values :deep(.el-tag) { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.summary-more, .summary-empty { padding-top: 3px; color: #9ca3af; font-size: 10px; }
@media (max-width: 640px) {
  .preset-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .custom-fields { grid-template-columns: 1fr; }
  .range-row :deep(.el-input-number) { width: 100px; }
}
</style>