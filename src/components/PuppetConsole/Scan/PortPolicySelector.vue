<template>
  <div class="port-policy-selector">
    <div class="policy-heading">
      <strong>端口范围</strong><span class="policy-summary">{{ preset === 'CUSTOM' ? totalPortCount.toLocaleString('zh-CN') + ' 个端口' : presets.find(item => item.value === preset)?.portCount }}</span>
    </div>
    <el-radio-group
      v-model="preset"
      class="preset-grid"
      fill="var(--app-brand-background)"
      text-color="var(--el-color-primary)"
    >
      <el-radio-button
        v-for="option in presets"
        :key="option.value"
        :value="option.value"
      >
        <span class="preset-option"><strong>{{ option.label }}</strong><small>{{ option.portCount }}</small></span>
      </el-radio-button>
    </el-radio-group>

    <div
      v-if="preset === 'CUSTOM'"
      class="custom-panel"
    >
      <div class="custom-heading">
        <strong>自定义端口</strong><el-button
          v-if="customPortsText || excludePortsText"
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
          :disabled="Boolean(parsedPolicy.error)"
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
          />
        </div>
        <div class="custom-field">
          <label for="exclude-ports">排除端口</label><el-input
            id="exclude-ports"
            v-model="excludePortsText"
            placeholder="例如：22, 23"
          />
        </div>
      </div>
      <p
        v-if="parseError"
        class="parse-error"
      >
        {{ parseError }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: Object, default: () => ({ preset: 'QUICK', customPorts: [], excludePorts: [] }) }
})
const emit = defineEmits(['update:modelValue', 'validity-change'])

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

const preset = ref(props.modelValue.preset || 'QUICK')
const customPortsText = ref(formatPorts(props.modelValue.customPorts || []))
const excludePortsText = ref(formatPorts(props.modelValue.excludePorts || []))
const parsedPolicy = computed(() => {
  try {
    const include = parsePortString(customPortsText.value)
    const exclude = parsePortString(excludePortsText.value)
    const excluded = new Set(exclude)
    return { include, exclude, ports: include.filter(port => !excluded.has(port)), error: '' }
  } catch (error) {
    return { include: [], exclude: [], ports: [], error: error.message }
  }
})
const totalPortCount = computed(() => parsedPolicy.value.ports.length)
const parseError = computed(() => parsedPolicy.value.error || (!totalPortCount.value ? '请至少包含一个有效端口' : ''))

watch([preset, parsedPolicy], () => {
  const valid = preset.value !== 'CUSTOM' || !parseError.value
  emit('validity-change', valid)
  emit('update:modelValue', {
    preset: preset.value,
    customPorts: parsedPolicy.value.ports,
    excludePorts: parsedPolicy.value.exclude
  })
}, { immediate: true, flush: 'sync' })

function isGroupSelected(group) {
  return group.ports.every(port => parsedPolicy.value.include.includes(port))
}
function isGroupPartial(group) {
  const selected = group.ports.filter(port => parsedPolicy.value.include.includes(port)).length
  return selected > 0 && selected < group.ports.length
}
function toggleGroup(group) {
  if (parsedPolicy.value.error) return
  const ports = new Set(parsedPolicy.value.include)
  const remove = isGroupSelected(group)
  group.ports.forEach(port => remove ? ports.delete(port) : ports.add(port))
  customPortsText.value = formatPorts([...ports])
}
function formatPorts(ports) {
  const sorted = [...new Set(ports)].sort((a, b) => a - b)
  const parts = []
  for (let index = 0; index < sorted.length; index++) {
    const start = sorted[index]
    while (sorted[index + 1] === sorted[index] + 1) index++
    parts.push(start === sorted[index] ? String(start) : `${start}-${sorted[index]}`)
  }
  return parts.join(', ')
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

function clearCustom() {
  customPortsText.value = ''
  excludePortsText.value = ''
}
</script>

<style scoped lang="scss">
.port-policy-selector { min-width: 0; color: var(--el-text-color-primary); }
.policy-heading, .custom-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.policy-heading { margin-bottom: 8px; }
.policy-heading strong, .custom-heading strong { font-size: 12px; font-weight: 600; }
.policy-summary { color: var(--el-text-color-secondary); font-size: 11px; white-space: nowrap; }
.preset-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); width: 100%; }
.preset-grid :deep(.el-radio-button), .preset-grid :deep(.el-radio-button__inner) { width: 100%; }
.preset-grid :deep(.el-radio-button__inner) { padding: 10px 4px; }
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
.group-chip.selected { border-color: var(--el-color-primary); color: var(--el-color-primary); background: var(--app-brand-background); }
.group-chip.selected small, .group-chip.partial small { color: inherit; }
.group-chip:disabled { opacity: 0.5; cursor: not-allowed; }
.group-chip:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: 2px; }
.custom-fields { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; margin-top: 12px; }
.custom-field label { display: block; margin-bottom: 6px; color: var(--el-text-color-regular); font-size: 11px; }
.custom-field :deep(.el-input__inner) { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; line-height: 1.5; }
.parse-error { margin: 8px 0 0; color: var(--el-color-danger); font-size: 11px; }
</style>
