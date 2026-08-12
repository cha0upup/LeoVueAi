<template>
  <el-dialog
    v-model="visible"
    title="批量端口扫描配置"
    width="520px"
    :close-on-click-modal="false"
    @close="handleCancel"
  >
    <div class="dlg-body">
      <!-- 主机摘要 -->
      <div class="hosts-summary">
        <el-icon class="summary-icon">
          <Icon :icon="iconMap.server" />
        </el-icon>
        <span>已选择 <strong>{{ selectedHosts.length }}</strong> 个主机，将为每个主机分别创建扫描任务</span>
      </div>

      <el-form
        ref="formRef"
        :model="scanConfig"
        :rules="formRules"
        label-position="top"
      >
        <!-- 扫描端口 -->
        <div class="cfg-section">
          <div class="cfg-section-label">
            扫描端口
          </div>

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
              <span
                class="cfg-hint"
                style="margin-top: 0;"
              >已选 {{ scanConfig.commonPorts.length }} / {{ commonPorts.length }}</span>
            </div>
            <el-checkbox-group
              v-model="scanConfig.commonPorts"
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
                v-model="scanConfig.startPort"
                :min="1"
                :max="65535"
                controls-position="right"
                class="ctrl-input"
                @change="generatePortRange"
              />
              <span class="ctrl-separator">—</span>
              <el-input-number
                v-model="scanConfig.endPort"
                :min="1"
                :max="65535"
                controls-position="right"
                class="ctrl-input"
                @change="generatePortRange"
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
              v-model="scanConfig.customPorts"
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
        </div>

        <div class="cfg-divider" />

        <!-- 扫描超时 -->
        <div class="cfg-section">
          <div class="cfg-section-label">
            扫描超时
          </div>
          <div class="inline-ctrl">
            <el-input-number
              v-model="scanConfig.scanTimeout"
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

        <div class="cfg-divider" />

        <!-- 线程数 -->
        <div class="cfg-section">
          <div class="cfg-section-label">
            线程数量
          </div>
          <div class="inline-ctrl">
            <el-input-number
              v-model="scanConfig.threadsNum"
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
    </div>

    <template #footer>
      <div class="dlg-footer">
        <el-button @click="handleCancel">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="isSubmitting"
          :disabled="!canSubmit"
          @click="handleConfirm"
        >
          开始批量扫描
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { icons } from '@/utils/icons.js'
import { showWarning } from '@/utils/messageUtils.js'

const iconMap = icons

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  selectedHosts: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:modelValue', 'confirm'])

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const formRef = ref(null)
const isSubmitting = ref(false)
const portInputMode = ref('common')
const parsedPorts = ref([])

const portModes = [
  { value: 'common', label: '常见端口' },
  { value: 'range', label: '端口范围' },
  { value: 'custom', label: '自定义' }
]

const scanConfig = ref({
  commonPorts: [],
  startPort: 1,
  endPort: 100,
  customPorts: '',
  scanTimeout: 3000,
  threadsNum: 50
})

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
  scanPorts: [
    {
      validator: (rule, value, callback) => {
        if (getPortsList().length === 0) callback(new Error('请至少选择一个端口'))
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

const isAllSelected = computed(() =>
  scanConfig.value.commonPorts.length === commonPorts.length && commonPorts.length > 0
)
const isIndeterminate = computed(() => {
  const n = scanConfig.value.commonPorts.length
  return n > 0 && n < commonPorts.length
})
const canSubmit = computed(() => props.selectedHosts.length > 0 && getPortsList().length > 0)

const getPortsList = () => {
  const ports = portInputMode.value === 'common' ? scanConfig.value.commonPorts || [] : parsedPorts.value
  return ports.map((p) => Number.parseInt(p, 10)).filter((p) => !isNaN(p) && p > 0 && p <= 65535)
}

const handleSelectAll = (checked) => {
  scanConfig.value.commonPorts = checked ? commonPorts.map((p) => p.value) : []
}

const setPortMode = (mode) => {
  portInputMode.value = mode
  if (mode === 'common') scanConfig.value.commonPorts = []
  else if (mode === 'range') { scanConfig.value.startPort = 1; scanConfig.value.endPort = 100; generatePortRange() }
  else { scanConfig.value.customPorts = ''; parsedPorts.value = [] }
}

const generatePortRange = () => {
  const { startPort: s, endPort: e } = scanConfig.value
  if (!s || !e || s > e) { parsedPorts.value = []; return }
  parsedPorts.value = Array.from({ length: e - s + 1 }, (_, i) => s + i)
}

const parseCustomPorts = () => {
  const input = scanConfig.value.customPorts.trim()
  if (!input) { parsedPorts.value = []; return }
  const ports = input.split(',').map((p) => parseInt(p.trim())).filter((p) => !isNaN(p) && p > 0 && p <= 65535)
  parsedPorts.value = [...new Set(ports)].sort((a, b) => a - b)
  if (parsedPorts.value.length === 0) showWarning('未解析到有效的端口号')
}

watch(
  [() => scanConfig.value.startPort, () => scanConfig.value.endPort, () => portInputMode.value],
  () => { if (portInputMode.value === 'range') generatePortRange() },
  { immediate: true }
)

watch(visible, (v) => {
  if (v && portInputMode.value === 'common') {
    scanConfig.value.commonPorts = commonPorts.map((p) => p.value)
  }
})

const resetForm = () => {
  scanConfig.value = { commonPorts: [], startPort: 1, endPort: 100, customPorts: '', scanTimeout: 3000, threadsNum: 50 }
  portInputMode.value = 'common'
  parsedPorts.value = []
  formRef.value?.clearValidate()
}

const handleCancel = () => {
  visible.value = false
  resetForm()
}

const handleConfirm = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    const ports = getPortsList()
    if (ports.length === 0) { showWarning('请至少选择一个端口'); return }
    if (props.selectedHosts.length === 0) { showWarning('请至少选择一个主机'); return }
    isSubmitting.value = true
    try {
      emit('confirm', {
        hosts: props.selectedHosts,
        scanPorts: ports,
        scanTimeout: scanConfig.value.scanTimeout,
        threadsNum: scanConfig.value.threadsNum
      })
      visible.value = false
      resetForm()
    } finally {
      isSubmitting.value = false
    }
  })
}
</script>

<style scoped>
/* ── Dialog body ─────────────────────────────────────────────────────── */
.dlg-body {
  padding: 4px 0 8px;
}

/* ── 主机摘要 ─────────────────────────────────────────────────────────── */
.hosts-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--el-color-primary) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 18%, transparent);
  color: var(--el-text-color-regular);
  font-size: var(--el-font-size-small);
  margin-bottom: 16px;
}

.hosts-summary strong {
  color: var(--el-color-primary);
  font-weight: 700;
}

.summary-icon {
  color: var(--el-color-primary);
  font-size: 15px;
  flex-shrink: 0;
}

/* ── 分组 ─────────────────────────────────────────────────────────────── */
.cfg-section {
  padding: 12px 0 8px;
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
  margin-bottom: 12px;
}

.mode-btn {
  height: 28px;
  padding: 0 14px;
  border: 1px solid var(--el-border-color);
  border-radius: 999px;
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
  border-radius: 10px 10px 0 0;
  background: var(--app-control-background-soft);
  border: 1px solid color-mix(in srgb, var(--el-border-color) 16%, transparent);
  border-bottom: none;
}

.common-ports-group {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 200px;
  overflow-y: auto;
  padding: 10px 12px;
  background: var(--app-control-background-soft);
  border: 1px solid color-mix(in srgb, var(--el-border-color) 16%, transparent);
  border-radius: 0 0 10px 10px;
}

.port-checkbox {
  margin: 0;
}

.port-checkbox :deep(.el-checkbox__label) {
  padding-left: 5px;
  font-size: 12px;
}

/* ── 端口范围 ─────────────────────────────────────────────────────────── */
.port-range-wrap,
.custom-port-wrap {
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
  border-radius: 10px;
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
.custom-port-input :deep(.el-textarea__inner) {
  border-radius: 10px;
  font-family: var(--el-font-family-mono);
  font-size: 13px;
  resize: none;
}

/* ── Footer ──────────────────────────────────────────────────────────── */
.dlg-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
