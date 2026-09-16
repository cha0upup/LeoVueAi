<template>
  <div class="target-input">
    <div class="target-toolbar">
      <label for="scan-targets">扫描目标</label>
      <el-button
        text
        size="small"
        :disabled="!inputText"
        @click="handleClear"
      >
        清空
      </el-button>
    </div>
    <p
      id="scan-targets-help"
      class="target-help"
    >
      每行一个，支持 IP、CIDR、域名、URL、主机端口
    </p>
    <el-input
      id="scan-targets"
      v-model="inputText"
      type="textarea"
      :rows="8"
      resize="none"
      aria-label="扫描目标"
      aria-describedby="scan-targets-help"
      placeholder="192.168.1.1
192.168.1.0/24
example.com:443
https://example.com"
      @input="handleInputChange"
    />
    <div class="target-meta">
      <span :class="{ 'target-valid': parsedTargets.length }">已识别 {{ parsedTargets.length.toLocaleString('zh-CN') }} 个目标</span>
      <span
        v-if="errors.length"
        class="target-invalid"
      >{{ errors.length.toLocaleString('zh-CN') }} 个格式错误</span>
      <el-button
        v-if="parsedTargets.length"
        text
        size="small"
        @click="showDetails = !showDetails"
      >
        {{ showDetails ? '收起明细' : '查看明细' }}
      </el-button>
    </div>

    <div
      v-if="errors.length"
      class="error-list"
    >
      <ul>
        <li
          v-for="(error, index) in errors.slice(0, 5)"
          :key="index"
        >
          <code>第 {{ error.lineNumber }} 行</code><span>{{ error.line }}</span><em>{{ error.reason }}</em>
        </li>
      </ul>
      <small v-if="errors.length > 5">其余 {{ errors.length - 5 }} 个错误未展开</small>
    </div>

    <el-collapse-transition>
      <div
        v-if="parsedTargets.length"
        v-show="showDetails"
        class="results-content"
      >
        <el-table
          :data="displayTargets"
          size="small"
          max-height="220"
        >
          <el-table-column
            label="目标"
            prop="input"
            min-width="145"
            show-overflow-tooltip
          />
          <el-table-column
            label="类型"
            prop="type"
            width="90"
          >
            <template #default="{ row }">
              <el-tag
                size="small"
                :type="getTypeTagType(row.type)"
              >
                {{ getTypeLabel(row.type) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            label="解析结果"
            prop="resolved"
            min-width="125"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              <span class="resolved-text">{{ formatResolved(row) }}</span>
            </template>
          </el-table-column>
          <el-table-column
            label="操作"
            width="60"
            align="center"
          >
            <template #default="{ $index }">
              <el-button
                size="small"
                type="danger"
                text
                @click="removeTarget($index)"
              >
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <div
          v-if="parsedTargets.length > displayTargets.length"
          class="pagination-info"
        >
          展示前 {{ displayTargets.length }} 个，共 {{ parsedTargets.length.toLocaleString('zh-CN') }} 个
        </div>
      </div>
    </el-collapse-transition>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:modelValue'])

// 状态
const inputText = ref('')
const parsedTargets = ref([])
const errors = ref([])
const showDetails = ref(false)
const lastEmittedText = ref(null)

// 计算属性
const displayTargets = computed(() => {
  return parsedTargets.value.slice(0, 20)
})

// 监听
watch(() => props.modelValue, (newVal) => {
  const incomingTargets = Array.isArray(newVal) ? newVal : []
  const incomingText = incomingTargets
    .map(target => typeof target === 'string' ? target : target?.input)
    .filter(Boolean)
    .join('\n')

  // v-model 会把当前解析结果回传回来。不要把“暂时没有有效结果”误判成外部清空，
  // 否则用户输入 1、h 等半成品时文本会被立刻擦掉。
  if (lastEmittedText.value !== null && incomingText === lastEmittedText.value) {
    lastEmittedText.value = null
    return
  }

  if (incomingText === inputText.value) return
  inputText.value = incomingText
  parsedTargets.value = incomingTargets
  errors.value = []
}, { immediate: true, deep: true })

// 方法
function handleInputChange() {
  parseTargets()
  emitTargets()
}

function emitTargets() {
  lastEmittedText.value = parsedTargets.value.map(target => target.input).join('\n')
  emit('update:modelValue', parsedTargets.value)
}

function parseTargets() {
  const lines = inputText.value.split('\n').filter(line => line.trim())
  const newTargets = []
  const newErrors = []

  lines.forEach((line, index) => {
    const trimmed = line.trim()
    if (!trimmed) return

    const result = parseTargetLine(trimmed)
    if (result.valid) {
      newTargets.push(result.target)
    } else {
      newErrors.push({
        line: trimmed,
        lineNumber: index + 1,
        reason: result.error
      })
    }
  })

  parsedTargets.value = newTargets
  errors.value = newErrors
}

function parseTargetLine(line) {
  // IPv4
  if (isValidIpv4(line)) {
    return {
      valid: true,
      target: { input: line, type: 'IPV4', resolved: line }
    }
  }

  // IPv4 CIDR
  const ipv4Cidr = line.match(/^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/)
  if (ipv4Cidr && isValidIpv4(ipv4Cidr[1]) && Number(ipv4Cidr[2]) <= 32) {
    return {
      valid: true,
      target: { input: line, type: 'CIDR', resolved: line }
    }
  }

  // IPv6 CIDR
  const cidrParts = line.split('/')
  if (cidrParts.length === 2 && isLikelyIpv6(cidrParts[0]) && /^\d{1,3}$/.test(cidrParts[1]) && Number(cidrParts[1]) <= 128) {
    return {
      valid: true,
      target: { input: line, type: 'CIDR', resolved: line }
    }
  }

  // IP Range
  const range = line.match(/^(\d{1,3}(?:\.\d{1,3}){3})-(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (range && isValidIpv4(range[1]) && isValidIpv4(range[2])) {
    return {
      valid: true,
      target: { input: line, type: 'IP_RANGE', resolved: line }
    }
  }

  // Bracketed IPv6 with port
  const bracketedIpv6Port = line.match(/^\[([^\]]+)]:(\d{1,5})$/)
  if (bracketedIpv6Port && isLikelyIpv6(bracketedIpv6Port[1]) && isValidPort(bracketedIpv6Port[2])) {
    return {
      valid: true,
      target: { input: line, type: 'HOST_PORT', resolved: line }
    }
  }

  // IPv6
  if (isLikelyIpv6(line)) {
    return {
      valid: true,
      target: { input: line, type: 'IPV6', resolved: line }
    }
  }

  // URL
  if (/^https?:\/\/.+/.test(line)) {
    return {
      valid: true,
      target: { input: line, type: 'URL', resolved: line }
    }
  }

  // Host:Port
  const hostPort = line.match(/^[a-zA-Z0-9.-]+:(\d{1,5})$/)
  if (hostPort && isValidPort(hostPort[1])) {
    return {
      valid: true,
      target: { input: line, type: 'HOST_PORT', resolved: line }
    }
  }

  // Domain
  if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(line)) {
    return {
      valid: true,
      target: { input: line, type: 'DOMAIN', resolved: line }
    }
  }

  return {
    valid: false,
    error: '无法识别的目标格式'
  }
}

function isValidIpv4(value) {
  const parts = String(value || '').split('.')
  return parts.length === 4 && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

function isValidPort(value) {
  const port = Number(value)
  return Number.isInteger(port) && port >= 1 && port <= 65535
}

function isLikelyIpv6(value) {
  const address = String(value || '').split('%')[0]
  if (!address || !address.includes(':') || !/^[0-9a-fA-F:]+$/.test(address)) return false
  if (address.includes(':::') || address.indexOf('::') !== address.lastIndexOf('::')) return false

  const groups = address.split(':')
  const hasCompression = address.includes('::')
  const nonEmptyGroups = groups.filter(Boolean)
  if (nonEmptyGroups.some(group => group.length > 4)) return false
  return hasCompression ? nonEmptyGroups.length < 8 : groups.length === 8
}

function removeTarget(index) {
  parsedTargets.value.splice(index, 1)

  // 重建输入文本
  inputText.value = parsedTargets.value.map(t => t.input).join('\n')
  emitTargets()
}

function handleClear() {
  inputText.value = ''
  parsedTargets.value = []
  errors.value = []
  emitTargets()
}

function getTypeLabel(type) {
  const labels = {
    'IPV4': 'IPv4',
    'IPV6': 'IPv6',
    'CIDR': 'CIDR',
    'IP_RANGE': 'IP范围',
    'DOMAIN': '域名',
    'URL': 'URL',
    'HOST_PORT': '主机端口'
  }
  return labels[type] || type
}

function getTypeTagType(type) {
  const types = {
    'IPV4': 'primary',
    'IPV6': 'primary',
    'CIDR': 'success',
    'IP_RANGE': 'success',
    'DOMAIN': 'warning',
    'URL': 'info',
    'HOST_PORT': 'info'
  }
  return types[type] || ''
}

function formatResolved(target) {
  if (target.type === 'CIDR') {
    const [network, prefixText] = target.input.split('/')
    const prefix = Number(prefixText)
    const bits = network.includes(':') ? 128 : 32
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > bits) return target.resolved
    const hosts = prefix === bits ? 1 : 2 ** (bits - prefix)
    return `~${hosts.toLocaleString()} 个主机`
  }
  if (target.type === 'IP_RANGE') {
    return '多个IP地址'
  }
  if (target.type === 'DOMAIN') {
    return '需要DNS解析'
  }
  return target.resolved
}
</script>

<style scoped lang="scss">
.target-input { width: 100%; min-width: 0; color: var(--el-text-color-primary); }
.target-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 24px; }
.target-toolbar label { font-size: 13px; font-weight: 600; }
.target-toolbar :deep(.el-button) { height: 24px; padding: 0 4px; }
.target-help { margin: 4px 0 10px; color: var(--el-text-color-secondary); font-size: 11px; line-height: 1.5; }
.target-input :deep(.el-textarea__inner) {
  padding: 10px 12px;
  color: var(--el-text-color-primary);
  background: var(--el-fill-color-blank);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  line-height: 1.65;
}
.target-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; min-height: 26px; margin-top: 4px; color: var(--el-text-color-secondary); font-size: 11px; }
.target-meta :deep(.el-button) { height: 24px; margin-left: auto; padding: 0 4px; font-size: 11px; }
.target-valid { color: var(--el-color-success); }
.target-invalid { color: var(--el-color-danger); }
.error-list { margin-top: 6px; padding: 8px 10px; border-radius: 4px; color: var(--el-color-danger); background: var(--el-color-danger-light-9); }
.error-list ul { display: grid; gap: 5px; margin: 0; padding: 0; list-style: none; }
.error-list li { display: flex; flex-wrap: wrap; gap: 6px; font-size: 11px; overflow-wrap: anywhere; }
.error-list code { font-family: monospace; }
.error-list em { font-style: normal; }
.error-list > small { display: block; margin-top: 6px; font-size: 11px; }
.results-content { margin-top: 8px; }
.results-content :deep(.el-table) { width: 100%; }
.results-content :deep(.el-table .cell) { padding: 0 6px; font-size: 11px; }
.results-content :deep(.el-table th.el-table__cell), .results-content :deep(.el-table td.el-table__cell) { padding: 5px 0; }
.resolved-text, .pagination-info { color: var(--el-text-color-secondary); font-size: 11px; }
.pagination-info { margin-top: 6px; text-align: center; }
</style>
