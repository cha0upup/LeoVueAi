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
        <button
          class="random-button"
          type="button"
          @click="emit('generate-random-header')"
        >
          <Icon :icon="iconMap.refresh" />
          随机
        </button>
      </div>
      <div class="header-pair">
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
  if (form.value.runtime === 'php') return '可选 Header 门禁'
  return form.value.protocol === 'websocket' ? 'WebSocket 查询门禁' : 'Header 门禁'
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
.gate-heading strong { color: var(--sg-ink); font-size: 10px; }
.gate-heading small { color: var(--sg-muted); font-size: 8px; }
.random-button { height: 25px; display: inline-flex; align-items: center; gap: 4px; padding: 0 8px; border: 1px solid var(--sg-border); border-radius: 7px; background: var(--sg-panel-strong); color: var(--sg-blue); font-size: 9px; cursor: pointer; }
.header-pair { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 7px; }
.header-pair > span { color: var(--sg-muted); font-weight: 700; }
@media (max-width: 760px) { .form-grid, .header-pair { grid-template-columns: 1fr; } }
</style>
