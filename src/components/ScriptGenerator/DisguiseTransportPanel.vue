<template>
  <section class="form-group transport-panel">
    <div class="group-heading">
      <strong>传输封装</strong>
    </div>
    <div class="form-grid">
      <el-form-item
        label="请求伪装"
        required
      >
        <el-select
          v-model="form.reqDisguiseId"
          placeholder="选择请求伪装"
          clearable
          filterable
        >
          <el-option
            v-for="item in disguises"
            :key="item.disguiseId"
            :label="`${item.disguiseName}(${item.version})`"
            :value="item.disguiseId"
          />
        </el-select>
      </el-form-item>
      <el-form-item
        label="响应伪装"
        required
      >
        <el-select
          v-model="form.respDisguiseId"
          placeholder="选择响应伪装"
          clearable
          filterable
        >
          <el-option
            v-for="item in disguises"
            :key="item.disguiseId"
            :label="`${item.disguiseName}(${item.version})`"
            :value="item.disguiseId"
          />
        </el-select>
      </el-form-item>
      <el-form-item
        label="HTTP 响应码"
        required
      >
        <el-input-number
          v-model="form.respCode"
          :min="100"
          :max="599"
          :controls="false"
          :precision="0"
        />
      </el-form-item>
      <el-form-item
        label="AES 密钥"
        required
      >
        <el-input
          v-model="form.payloadKey"
          clearable
          placeholder="请输入 AES 密钥"
        >
          <template #append>
            <el-button
              class="payload-key-random-btn"
              title="生成随机 AES 密钥"
              aria-label="生成随机 AES 密钥"
              @click="form.payloadKey = generatePayloadKey()"
            >
              <el-icon><Icon :icon="iconMap.refresh" /></el-icon>
            </el-button>
          </template>
        </el-input>
      </el-form-item>
    </div>

    <div
      v-if="showHeaderGate"
      class="transport-gate"
    >
      <div class="gate-heading">
        <div>
          <strong>{{ headerGateTitle }}</strong>
          <small v-if="form.runtime === 'php'">留空时关闭；填写时名称和值必须成对配置</small>
        </div>
        <el-button
          class="random-button"
          text
          size="small"
          :title="`随机生成 ${headerGateTitle}`"
          :aria-label="`随机生成 ${headerGateTitle}`"
          @click="emit('generate-random-header')"
        >
          <Icon :icon="iconMap.refresh" />
          随机生成
        </el-button>
      </div>
      <div class="header-pair">
        <el-form-item :label="form.protocol === 'websocket' ? '查询参数名称' : 'Header 名称'">
          <el-input
            v-model="form.headerName"
            :placeholder="form.protocol === 'websocket' ? '如 token' : '如 X-Token'"
          />
        </el-form-item>
        <el-form-item :label="form.protocol === 'websocket' ? '查询参数值' : 'Header 值'">
          <el-input
            v-model="form.headerValue"
            placeholder="输入校验值"
          />
        </el-form-item>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { icons } from '@/utils/icons.js'
import { generatePayloadKey } from '@/utils/payloadKey.js'

const form = defineModel('form', { type: Object, required: true })
defineProps({
  disguises: { type: Array, default: () => [] },
  showHeaderGate: { type: Boolean, default: true }
})
const emit = defineEmits(['generate-random-header'])

const iconMap = icons
const headerGateTitle = computed(() => {
  if (form.value.runtime === 'php') return '可选 Header 校验'
  return form.value.protocol === 'websocket' ? 'WebSocket 查询校验' : 'Header 校验'
})
</script>

<style scoped>
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px 10px; }
.group-heading { margin-bottom: 9px; }
.group-heading strong { color: var(--sg-ink); font-size: 12px; }
.payload-key-random-btn { width: 32px; padding: 0; }
.transport-gate { margin-top: 11px; padding-top: 10px; border-top: 1px solid color-mix(in srgb, var(--el-border-color) 18%, transparent); }
.gate-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 7px; }
.gate-heading > div { display: flex; flex-direction: column; gap: 2px; }
.gate-heading strong { color: var(--sg-ink); font-size: 12px; }
.gate-heading small { color: var(--sg-muted); font-size: 11px; }
.random-button { height: 28px; padding: 0 6px; color: var(--sg-blue); font-size: 11px; }
.random-button :deep(.iconify) { margin-right: 4px; }
.header-pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.transport-panel :deep(.el-input-number .el-input__inner) { text-align: left; }
@media (max-width: 760px) { .form-grid, .header-pair { grid-template-columns: 1fr; } }
</style>
