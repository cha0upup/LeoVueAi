<template>
  <div class="target-input">
    <el-input
      v-model="inputText"
      type="textarea"
      :rows="9"
      aria-label="扫描目标"
      placeholder="每行一个目标，例如：&#10;192.168.1.1&#10;192.168.1.0/24&#10;example.com:443"
      @input="handleInputChange"
    />
    <div class="target-meta">
      <span class="target-hint">IP / CIDR / URL / 主机:端口</span>
      <span v-if="parsedTargets.length" class="target-valid">{{ parsedTargets.length.toLocaleString('zh-CN') }} 个有效</span>
      <span v-if="errors.length" class="target-invalid">{{ errors.length.toLocaleString('zh-CN') }} 个错误</span>
    </div>

    <div class="quick-actions">
      <el-button size="small" text @click="handleClear" :disabled="!inputText">
        <el-icon><Delete /></el-icon>
        清空
      </el-button>
    </div>

    <el-collapse-transition>
      <div v-if="parsedTargets.length > 0" class="parsed-results">
        <div class="results-header">
          <span>目标预览</span>
          <el-button size="small" text @click="showDetails = !showDetails">
            {{ showDetails ? '收起' : '展开' }}
          </el-button>
        </div>

        <el-collapse-transition>
          <div v-show="showDetails" class="results-content">
            <el-table :data="displayTargets" size="small" max-height="300">
              <el-table-column label="目标" prop="input" min-width="200" />
              <el-table-column label="类型" prop="type" width="120">
                <template #default="{ row }">
                  <el-tag size="small" :type="getTypeTagType(row.type)">
                    {{ getTypeLabel(row.type) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="解析结果" prop="resolved" min-width="200">
                <template #default="{ row }">
                  <span class="resolved-text">{{ formatResolved(row) }}</span>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="80" align="center">
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

            <div v-if="parsedTargets.length > displayTargets.length" class="pagination-info">
              展示前 {{ displayTargets.length }} 个，共 {{ parsedTargets.length.toLocaleString('zh-CN') }} 个
            </div>
          </div>
        </el-collapse-transition>
      </div>
    </el-collapse-transition>

    <el-collapse-transition>
      <div v-if="errors.length > 0" class="error-list">
        <el-alert type="error" :closable="false">
          <template #title>
            <div class="error-title">{{ errors.length }} 个目标格式无效</div>
          </template>
          <ul class="error-items">
            <li v-for="(error, idx) in errors.slice(0, 5)" :key="idx">
              <code>{{ error.line }}</code> - {{ error.reason }}
            </li>
          </ul>
          <div v-if="errors.length > 5" class="error-more">
            其余 {{ errors.length - 5 }} 个未展开
          </div>
        </el-alert>
      </div>
    </el-collapse-transition>

  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Delete } from '@element-plus/icons-vue'

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
.target-input {
  .target-meta {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 19px;
    margin-top: 7px;
    color: #8b97a3;
    font-size: 11px;
  }

  .target-hint {
    margin-right: auto;
  }

  .target-valid {
    color: #0f766e;
  }

  .target-invalid {
    color: #b91c1c;
  }

  .quick-actions {
    display: flex;
    margin: 10px 0 14px;
  }

  .parsed-results {
    margin-top: 14px;
    padding-top: 4px;

    .results-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      font-weight: 600;
    }

    .results-content {
      .resolved-text {
        font-size: 12px;
        color: #606266;
      }

      .pagination-info {
        margin-top: 8px;
        text-align: center;
        font-size: 12px;
        color: #909399;
      }
    }
  }

  .error-list {
    margin-top: 12px;

    .error-title {
      font-weight: 600;
      margin-bottom: 5px;
    }

    .error-items {
      margin: 0;
      padding-left: 20px;
      font-size: 12px;

      li {
        margin-bottom: 4px;

        code {
          background: rgba(0, 0, 0, 0.1);
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 12px;
        }
      }
    }

    .error-more {
      margin-top: 8px;
      font-size: 12px;
      color: #909399;
    }
  }
}
</style>
