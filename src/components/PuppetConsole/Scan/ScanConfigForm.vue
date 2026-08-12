<template>
  <div class="cfg-form scan-config-surface">
    <el-form
      ref="formRef"
      :model="scanForm"
      :rules="formRules"
    >
      <!-- 目标主机 -->
      <div class="cfg-section cfg-section--target">
        <div class="cfg-section-label">
          目标主机
        </div>
        <el-form-item
          prop="scanHost"
          class="cfg-field-bare"
        >
          <el-input
            v-model="scanForm.scanHost"
            placeholder="IP 地址或域名，例如 192.168.1.100"
            clearable
            class="host-input"
          >
            <template #prefix>
              <el-icon><Icon :icon="iconMap.server" /></el-icon>
            </template>
          </el-input>
        </el-form-item>
      </div>

      <div class="cfg-divider" />

      <!-- 扫描端口 -->
      <div class="cfg-section cfg-section--ports">
        <div class="cfg-section-label">
          扫描端口
        </div>

        <!-- 模式选择 -->
        <div class="mode-row">
          <button
            v-for="m in portModes"
            :key="m.value"
            type="button"
            class="mode-btn"
            :class="{ active: portInputMode === m.value }"
            @click="setPortMode(m.value)"
          >
            {{ m.label }}
          </button>
        </div>

        <!-- 常见端口 -->
        <div
          v-if="portInputMode === 'common'"
          class="port-selector"
        >
          <div class="port-selector-bar">
            <el-checkbox
              :model-value="isAllSelected"
              :indeterminate="isIndeterminate"
              @change="handleSelectAll"
            >
              全选
            </el-checkbox>
            <span class="cfg-hint">已选 {{ scanForm.commonPorts.length }} / {{ commonPorts.length }}</span>
          </div>
          <el-checkbox-group
            v-model="scanForm.commonPorts"
            class="common-ports-group"
          >
            <el-checkbox
              v-for="port in commonPorts"
              :key="port.value"
              :label="port.value"
              class="port-checkbox"
            >
              {{ port.label }} ({{ port.value }})
            </el-checkbox>
          </el-checkbox-group>
        </div>

        <!-- 端口范围 -->
        <div
          v-if="portInputMode === 'range'"
          class="port-range-wrap"
        >
          <div class="inline-ctrl">
            <el-input-number
              v-model="scanForm.startPort"
              :min="1"
              :max="65535"
              controls-position="right"
              class="ctrl-input"
              placeholder="起始"
            />
            <span class="ctrl-separator">—</span>
            <el-input-number
              v-model="scanForm.endPort"
              :min="1"
              :max="65535"
              controls-position="right"
              class="ctrl-input"
              placeholder="结束"
            />
          </div>
          <div class="cfg-hint">
            已生成 {{ parsedPorts.length }} 个端口
          </div>
        </div>

        <!-- 自定义端口 -->
        <div
          v-if="portInputMode === 'custom'"
          class="custom-port-wrap"
        >
          <el-input
            v-model="scanForm.customPorts"
            type="textarea"
            :rows="3"
            resize="none"
            placeholder="多个端口用逗号分隔，例如：80,443,8080,3306"
            class="custom-port-input"
            @blur="parseCustomPorts"
          />
          <div class="cfg-hint">
            已解析 {{ parsedPorts.length }} 个端口
          </div>
        </div>

        <!-- 端口预览 -->
        <div
          v-if="portsPreview.length > 0"
          class="ports-preview"
        >
          <span class="ports-preview-label">预览</span>
          <div class="ports-preview-list">
            <span
              v-for="port in portsPreview"
              :key="port"
              class="port-chip"
            >{{ port }}</span>
            <span
              v-if="getPortsList().length > portsPreview.length"
              class="ports-more"
            >
              +{{ getPortsList().length - portsPreview.length }}
            </span>
          </div>
        </div>
      </div>

      <div class="cfg-divider" />

      <!-- 超时 & 线程 -->
      <div class="cfg-section cfg-section--timeout">
        <div class="cfg-section-label">
          扫描超时
        </div>
        <div class="inline-ctrl">
          <el-input-number
            v-model="scanForm.scanTimeout"
            :min="1000"
            :max="10000"
            :step="500"
            controls-position="right"
            class="ctrl-input"
          />
          <span class="ctrl-unit">ms</span>
        </div>
        <div class="cfg-hint">
          建议 3000–5000 ms，过短可能导致误判
        </div>
      </div>

      <div class="cfg-section cfg-section--threads">
        <div class="cfg-section-label">
          线程数量
        </div>
        <div class="inline-ctrl">
          <el-input-number
            v-model="scanForm.threadsNum"
            :min="1"
            :max="200"
            controls-position="right"
            class="ctrl-input"
          />
          <span class="ctrl-unit">threads</span>
        </div>
        <div class="cfg-hint">
          控制并发扫描数量，建议按目标主机性能调整
        </div>
      </div>
    </el-form>

    <div class="cfg-actions">
      <el-button
        type="primary"
        :loading="isStarting"
        :disabled="!canStartScan"
        class="action-btn"
        @click="handleStartScan"
      >
        <el-icon><Icon :icon="iconMap.play" /></el-icon>
        开始扫描
      </el-button>
      <el-button
        class="action-btn action-btn-ghost"
        @click="handleResetForm"
      >
        重置
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { icons } from '@/utils/icons.js'
import { showWarning } from '@/utils/messageUtils.js'

const iconMap = icons

defineProps({
  isStarting: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['start-scan'])

const formRef = ref(null)
const portInputMode = ref('common')

const portModes = [
  { value: 'common', label: '常见端口' },
  { value: 'range', label: '端口范围' },
  { value: 'custom', label: '自定义' }
]

const scanForm = ref({
  scanHost: '',
  scanPorts: [],
  scanTimeout: 3000,
  threadsNum: 50,
  commonPorts: [],
  startPort: 1,
  endPort: 100,
  customPorts: ''
})

const parsedPorts = ref([])
const commonPorts = [
  { value: 21, label: 'FTP' },
  { value: 22, label: 'SSH' },
  { value: 23, label: 'Telnet' },
  { value: 25, label: 'SMTP' },
  { value: 53, label: 'DNS' },
  { value: 80, label: 'HTTP' },
  { value: 110, label: 'POP3' },
  { value: 135, label: 'RPC' },
  { value: 139, label: 'NetBIOS' },
  { value: 143, label: 'IMAP' },
  { value: 161, label: 'SNMP' },
  { value: 443, label: 'HTTPS' },
  { value: 445, label: 'SMB' },
  { value: 993, label: 'IMAPS' },
  { value: 995, label: 'POP3S' },
  { value: 389, label: 'LDAP' },
  { value: 636, label: 'LDAPS' },
  { value: 1433, label: 'SQL Server' },
  { value: 1521, label: 'Oracle' },
  { value: 3306, label: 'MySQL' },
  { value: 5432, label: 'PostgreSQL' },
  { value: 6379, label: 'Redis' },
  { value: 27017, label: 'MongoDB' },
  { value: 9200, label: 'Elasticsearch' },
  { value: 3389, label: 'RDP' },
  { value: 5900, label: 'VNC' },
  { value: 5901, label: 'VNC-1' },
  { value: 8080, label: 'HTTP-Alt' },
  { value: 8081, label: 'HTTP-Proxy' },
  { value: 8443, label: 'HTTPS-Alt' },
  { value: 9000, label: 'SonarQube' },
  { value: 9090, label: 'WebSphere' },
  { value: 11211, label: 'Memcached' },
  { value: 27018, label: 'MongoDB-Shard' },
  { value: 50000, label: 'SAP' }
]

const formRules = {
  scanHost: [
    { required: true, message: '请输入目标主机地址', trigger: 'blur' },
    {
      pattern:
        /^((\d{1,3}\.){3}\d{1,3}|([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,})$/,
      message: '请输入有效的IP地址或域名',
      trigger: 'blur'
    }
  ],
  scanPorts: [
    {
      validator: (rule, value, callback) => {
        const ports = getPortsList()
        if (ports.length === 0) callback(new Error('请至少选择一个端口'))
        else callback()
      },
      trigger: 'change'
    }
  ],
  scanTimeout: [
    { required: true, message: '请输入扫描超时时间', trigger: 'blur' },
    { type: 'number', min: 1000, max: 10000, message: '超时时间应在1000-10000毫秒之间', trigger: 'blur' }
  ],
  threadsNum: [
    { required: true, message: '请输入线程数量', trigger: 'blur' },
    { type: 'number', min: 1, max: 200, message: '线程数量应在1-200之间', trigger: 'blur' }
  ]
}

const canStartScan = computed(() => scanForm.value.scanHost && getPortsList().length > 0)
const portsPreview = computed(() => getPortsList().slice(0, 10))
const isAllSelected = computed(() =>
  scanForm.value.commonPorts.length === commonPorts.length && commonPorts.length > 0
)
const isIndeterminate = computed(() => {
  const n = scanForm.value.commonPorts.length
  return n > 0 && n < commonPorts.length
})

const handleSelectAll = (checked) => {
  scanForm.value.commonPorts = checked ? commonPorts.map((p) => p.value) : []
}

const setPortMode = (mode) => {
  portInputMode.value = mode
  if (mode === 'common') scanForm.value.commonPorts = []
  else if (mode === 'range') { scanForm.value.startPort = 1; scanForm.value.endPort = 100 }
  else { scanForm.value.customPorts = ''; parsedPorts.value = [] }
}

const getPortsList = () => {
  const ports = portInputMode.value === 'common' ? scanForm.value.commonPorts || [] : parsedPorts.value
  return ports
    .map((p) => Number.parseInt(p, 10))
    .filter((p) => !isNaN(p) && p > 0 && p <= 65535)
}

const generatePortRange = () => {
  const start = scanForm.value.startPort
  const end = scanForm.value.endPort
  if (!start || !end || start > end) { parsedPorts.value = []; return }
  parsedPorts.value = []
  for (let i = start; i <= end; i++) parsedPorts.value.push(i)
}

watch(
  [() => scanForm.value.startPort, () => scanForm.value.endPort, () => portInputMode.value],
  () => { if (portInputMode.value === 'range') generatePortRange() },
  { immediate: true }
)

const parseCustomPorts = () => {
  const input = scanForm.value.customPorts.trim()
  if (!input) { parsedPorts.value = []; return }
  const ports = input
    .split(',')
    .map((p) => parseInt(p.trim()))
    .filter((p) => !isNaN(p) && p > 0 && p <= 65535)
  parsedPorts.value = [...new Set(ports)].sort((a, b) => a - b)
  if (parsedPorts.value.length === 0) showWarning('未解析到有效的端口号')
}

const handleStartScan = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    const ports = getPortsList()
    if (ports.length === 0) { showWarning('请至少选择一个端口'); return }
    emit('start-scan', {
      scanHost: scanForm.value.scanHost,
      scanPorts: ports,
      scanTimeout: scanForm.value.scanTimeout,
      threadsNum: scanForm.value.threadsNum
    })
  })
}

const handleResetForm = () => {
  scanForm.value = {
    scanHost: '',
    scanPorts: [],
    scanTimeout: 3000,
    threadsNum: 50,
    commonPorts: [],
    startPort: 1,
    endPort: 100,
    customPorts: ''
  }
  portInputMode.value = 'common'
  parsedPorts.value = []
  formRef.value?.clearValidate()
}
</script>

<style scoped>
/* ── 表单容器 ─────────────────────────────────────────────────────────── */
.cfg-form {
  display: flex;
  flex-direction: column;
  gap: 0;
  height: auto;
}

/* ── 分组 ─────────────────────────────────────────────────────────────── */
.cfg-section {
  padding: 10px 0 8px;
}

.cfg-section-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--el-text-color-secondary);
  margin-bottom: 10px;
}

.cfg-divider {
  height: 1px;
  background: color-mix(in srgb, var(--el-border-color) 22%, transparent);
  margin: 0;
}

/* ── 字段 ─────────────────────────────────────────────────────────────── */
.cfg-field-bare {
  margin-bottom: 0;
}

.cfg-field-bare :deep(.el-form-item__content) {
  display: block;
}

.host-input :deep(.el-input__wrapper) {
  border-radius: var(--radius-control);
}

/* ── 提示文字 ─────────────────────────────────────────────────────────── */
.cfg-hint {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  margin-top: 6px;
  line-height: 1.5;
}

/* ── 端口模式切换 ─────────────────────────────────────────────────────── */
.mode-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.mode-btn {
  height: 28px;
  padding: 0 14px;
  border: 1px solid var(--el-border-color);
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--el-text-color-regular);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.mode-btn:hover {
  border-color: var(--el-color-primary-light-5);
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 6%, transparent);
}

.mode-btn.active {
  border-color: var(--el-color-primary-light-5);
  background: color-mix(in srgb, var(--el-color-primary) 10%, transparent);
  color: var(--el-color-primary);
}

/* ── 常见端口 ─────────────────────────────────────────────────────────── */
.port-selector-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: var(--radius-control) var(--radius-control) 0 0;
  background: var(--app-control-background-soft);
  border: 1px solid color-mix(in srgb, var(--el-border-color) 16%, transparent);
  border-bottom: none;
}

.port-selector-bar .cfg-hint {
  margin-top: 0;
}

.common-ports-group {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 136px;
  overflow-y: auto;
  padding: 10px 12px;
  background: var(--app-control-background-soft);
  border: 1px solid color-mix(in srgb, var(--el-border-color) 16%, transparent);
  border-radius: 0 0 var(--radius-control) var(--radius-control);
}

.port-checkbox {
  margin: 0;
}

.port-checkbox :deep(.el-checkbox__label) {
  padding-left: 5px;
  font-size: 12px;
}

/* ── 端口范围 ─────────────────────────────────────────────────────────── */
.port-range-wrap {
  display: flex;
  flex-direction: column;
}

/* ── 内联控件 ─────────────────────────────────────────────────────────── */
.inline-ctrl {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ctrl-input {
  flex: 1;
  min-width: 0;
}

.ctrl-input :deep(.el-input__wrapper) {
  border-radius: var(--radius-control);
}

.ctrl-unit {
  font-size: var(--el-font-size-small);
  font-weight: 600;
  color: var(--el-text-color-regular);
  flex-shrink: 0;
}

.ctrl-separator {
  color: var(--el-text-color-secondary);
  font-weight: 600;
  flex-shrink: 0;
}

/* ── 自定义端口 ───────────────────────────────────────────────────────── */
.custom-port-wrap {
  display: flex;
  flex-direction: column;
}

.custom-port-input :deep(.el-textarea__inner) {
  border-radius: var(--radius-control);
  font-family: var(--el-font-family-mono);
  font-size: 13px;
  resize: none;
}

/* ── 端口预览 ─────────────────────────────────────────────────────────── */
.ports-preview {
  margin-top: 10px;
  padding: 8px 12px;
  border-radius: var(--radius-control);
  background: color-mix(in srgb, var(--app-control-background-soft) 60%, transparent);
  border: 1px dashed color-mix(in srgb, var(--el-border-color) 18%, transparent);
}

.ports-preview-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--el-text-color-secondary);
  margin-bottom: 6px;
}

.ports-preview-list {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.port-chip {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: var(--app-control-background);
  border: 1px solid color-mix(in srgb, var(--el-border-color) 22%, transparent);
  font-size: 11px;
  color: var(--el-text-color-regular);
  font-family: var(--el-font-family-mono);
}

.ports-more {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  font-weight: 600;
}

/* ── 操作按钮行 ──────────────────────────────────────────────────────── */
.cfg-actions {
  display: flex;
  gap: 8px;
  padding: 12px 0 2px;
  margin-top: 0;
}

.action-btn {
  flex: 1;
  height: 36px;
  border-radius: var(--radius-control);
  font-weight: 600;
}

.action-btn-ghost {
  flex: 0 0 auto;
  min-width: 72px;
  flex: none;
}

@media (min-width: 1800px) {
  .cfg-form > :deep(.el-form) {
    display: grid;
    grid-template-columns: minmax(0, 1.65fr) minmax(280px, 0.75fr);
    grid-template-rows: auto auto;
    align-items: start;
    column-gap: 20px;
  }

  .cfg-form > :deep(.el-form) > .cfg-divider {
    display: none;
  }

  .cfg-section--target {
    grid-column: 1;
    grid-row: 1;
  }

  .cfg-section--ports {
    grid-column: 1;
    grid-row: 2 / span 2;
  }

  .cfg-section--timeout {
    grid-column: 2;
    grid-row: 1;
  }

  .cfg-section--threads {
    grid-column: 2;
    grid-row: 2;
  }

  .cfg-actions {
    justify-content: flex-end;
    padding-top: 8px;
  }

  .action-btn {
    flex: 0 0 240px;
  }

  .action-btn-ghost {
    flex: 0 0 72px;
  }
}
</style>
