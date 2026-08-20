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
        label="PayloadCodec AES 密钥"
        required
      >
        <el-input
          v-model="form.payloadKey"
          clearable
          placeholder="请输入用户自定义 AES 密钥"
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
  </section>
</template>

<script setup>
import { icons } from '@/utils/icons.js'
import { generatePayloadKey } from '@/utils/payloadKey.js'

const form = defineModel('form', { type: Object, required: true })
defineProps({ disguises: { type: Array, default: () => [] } })

const iconMap = icons
</script>

<style scoped>
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px 10px; }
.group-heading { margin-bottom: 9px; }
.group-heading strong { color: var(--sg-ink); font-size: 12px; }
.payload-key-random-btn { width: 32px; padding: 0; }
@media (max-width: 760px) { .form-grid { grid-template-columns: 1fr; } }
</style>
