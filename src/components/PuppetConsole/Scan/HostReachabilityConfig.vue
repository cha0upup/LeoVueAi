<template>
  <div class="cfg-form scan-config-surface">
    <el-form
      ref="formRef"
      :model="scanForm"
      :rules="formRules"
    >
      <!-- 目标主机 -->
      <div class="cfg-section">
        <div class="cfg-section-label">
          目标主机
        </div>
        <el-form-item
          prop="scanHosts"
          class="cfg-field-bare"
        >
          <el-input
            v-model="scanForm.hostsInput"
            type="textarea"
            :rows="6"
            resize="none"
            class="hosts-input"
            placeholder="每行一个，支持 IP、CIDR、域名&#10;192.168.1.1&#10;192.168.1.0/24&#10;example.com"
            @blur="parseHosts"
          />
        </el-form-item>
        <div class="hosts-meta">
          <span class="hosts-count">
            已解析 <strong>{{ parsedHosts.length }}</strong> 个主机
          </span>
          <span class="cfg-hint">支持粘贴网段，自动去重</span>
        </div>
      </div>

      <div class="cfg-divider" />

      <!-- 检测超时 -->
      <div class="cfg-section">
        <div class="cfg-section-label">
          检测超时
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
        <div class="preset-row">
          <button
            v-for="p in timeoutPresets"
            :key="p"
            type="button"
            class="preset-btn"
            :class="{ active: scanForm.scanTimeout === p }"
            @click="scanForm.scanTimeout = p"
          >
            {{ p }} ms
          </button>
        </div>
        <div class="cfg-hint">
          建议 3000–5000 ms，网络抖动较大时适当调高
        </div>
      </div>
    </el-form>

    <div class="cfg-actions">
      <el-button
        type="primary"
        :loading="isScanning"
        :disabled="parsedHosts.length === 0"
        class="action-btn"
        @click="handleScan"
      >
        <el-icon><Icon :icon="iconMap.play" /></el-icon>
        开始探活
      </el-button>
      <el-button
        class="action-btn action-btn-ghost"
        @click="handleReset"
      >
        重置
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Icon } from '@iconify/vue'
import { icons } from '@/utils/icons.js'
import { parseCIDR, isCIDR, isValidIP } from '@/utils/dataUtils.js'
import { showWarning } from '@/utils/messageUtils.js'

const iconMap = icons

defineProps({
  isScanning: { type: Boolean, default: false }
})

const emit = defineEmits(['scan'])

const formRef = ref(null)
const scanForm = ref({ hostsInput: '', scanTimeout: 3000 })
const parsedHosts = ref([])
const timeoutPresets = [2000, 3000, 5000]

const formRules = {
  scanHosts: [
    {
      validator: (rule, value, callback) => {
        if (parsedHosts.value.length === 0) callback(new Error('请至少输入一个主机地址'))
        else if (parsedHosts.value.length > 1000) callback(new Error('主机数量不能超过 1000 个'))
        else callback()
      },
      trigger: 'change'
    }
  ]
}

const parseHosts = () => {
  const input = scanForm.value.hostsInput.trim()
  if (!input) { parsedHosts.value = []; return }

  const allHosts = []
  const lines = input.split('\n').map(l => l.trim()).filter(l => l.length > 0)

  for (const line of lines) {
    try {
      if (isCIDR(line)) {
        allHosts.push(...parseCIDR(line))
      } else if (isValidIP(line)) {
        allHosts.push(line)
      } else {
        const domainPattern = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/
        if (domainPattern.test(line) || line.includes('.')) allHosts.push(line)
      }
    } catch (error) {
      showWarning(`解析 "${line}" 失败: ${error.message}`)
    }
  }

  parsedHosts.value = [...new Set(allHosts)]

  if (parsedHosts.value.length === 0) {
    showWarning('未解析到有效的主机地址')
  } else if (parsedHosts.value.length > 1000) {
    showWarning(`解析到 ${parsedHosts.value.length} 个主机，将限制为前 1000 个`)
    parsedHosts.value = parsedHosts.value.slice(0, 1000)
  }
}

const handleScan = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    if (parsedHosts.value.length === 0) { showWarning('请至少输入一个主机地址'); return }
    emit('scan', { scanHosts: parsedHosts.value, scanTimeout: scanForm.value.scanTimeout })
  })
}

const handleReset = () => {
  scanForm.value = { hostsInput: '', scanTimeout: 3000 }
  parsedHosts.value = []
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
  container-name: scan-config;
  container-type: inline-size;
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

.hosts-input :deep(.el-textarea__inner) {
  border-radius: var(--radius-control);
  padding: 9px 11px;
  line-height: 1.55;
  font-family: var(--el-font-family-mono);
  font-size: 13px;
  min-height: 132px;
  resize: none;
}

.hosts-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  gap: 8px;
}

.hosts-count {
  font-size: var(--el-font-size-small);
  color: var(--el-text-color-regular);
}

.hosts-count strong {
  color: var(--el-text-color-primary);
  font-weight: 700;
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

/* ── 预设按钮行 ──────────────────────────────────────────────────────── */
.preset-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.preset-btn {
  height: 28px;
  padding: 0 12px;
  border: 1px solid var(--el-border-color);
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--el-text-color-regular);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.preset-btn:hover {
  border-color: var(--el-color-primary-light-5);
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 6%, transparent);
}

.preset-btn.active {
  border-color: var(--el-color-primary-light-5);
  background: color-mix(in srgb, var(--el-color-primary) 10%, transparent);
  color: var(--el-color-primary);
}

/* ── 提示文字 ─────────────────────────────────────────────────────────── */
.cfg-hint {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  margin-top: 6px;
  line-height: 1.5;
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

@container scan-config (min-width: 700px) {
  .cfg-form > :deep(.el-form) {
    display: grid;
    grid-template-columns: minmax(0, 1.65fr) minmax(250px, 0.75fr);
    align-items: start;
    gap: 18px;
  }

  .cfg-form > :deep(.el-form) > .cfg-divider {
    display: none;
  }

  .cfg-form > :deep(.el-form) > .cfg-section {
    padding-top: 8px;
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
