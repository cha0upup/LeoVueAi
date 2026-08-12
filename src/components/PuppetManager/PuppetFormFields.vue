<template>
  <el-form
    ref="formRef"
    :model="puppet"
    :rules="rules"
    label-width="120px"
    label-position="left"
    class="host-form"
    @submit.prevent="emit('submit')"
  >
    <div class="form-section">
      <div class="section-heading">
        <div>
          <strong>连接信息</strong>
        </div>
      </div>
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item
            label="主机名称"
            prop="puppetName"
          >
            <el-input
              v-model="puppet.puppetName"
              placeholder="请输入主机名称"
              clearable
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item
            label="连接地址"
            prop="connLink"
          >
            <el-input
              v-model="puppet.connLink"
              placeholder="请输入主机连接地址"
              clearable
            >
              <template #prefix>
                <el-icon><Icon :icon="iconMap.link" /></el-icon>
              </template>
            </el-input>
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="20">
        <el-col :span="8">
          <el-form-item
            label="传输协议"
            prop="protocol"
          >
            <el-select
              v-model="puppet.protocol"
              placeholder="请选择传输协议"
              style="width: 100%"
            >
              <el-option
                v-for="item in allProtocol"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              >
                <div class="option-content">
                  <el-icon class="option-icon">
                    <Icon :icon="iconMap.connection" />
                  </el-icon>
                  <span>{{ item.label }}</span>
                </div>
              </el-option>
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item
            label="节点类型"
            prop="type"
          >
            <el-select
              v-model="puppet.type"
              placeholder="请选择节点类型"
              style="width: 100%"
            >
              <el-option
                v-for="item in allTypes"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              >
                <div class="option-content">
                  <el-icon class="option-icon">
                    <Icon :icon="iconMap.code" />
                  </el-icon>
                  <span>{{ item.label }}</span>
                </div>
              </el-option>
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item
            label="访问权限"
            prop="permission"
          >
            <el-select
              v-model="puppet.permission"
              placeholder="请选择访问权限"
              style="width: 100%"
            >
              <el-option
                v-for="item in permissions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              >
                <div class="option-content">
                  <el-icon class="option-icon">
                    <Icon
                      v-if="item.value === 'public'"
                      :icon="iconMap.check"
                    />
                    <Icon
                      v-else-if="item.value === 'team'"
                      :icon="iconMap.user"
                    />
                    <Icon
                      v-else-if="item.value === 'private'"
                      :icon="iconMap.lock"
                    />
                  </el-icon>
                  <span>{{ item.label }}</span>
                </div>
              </el-option>
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <div class="section-heading section-heading--spaced">
        <div>
          <strong>伪装配置</strong>
        </div>
      </div>

      <div class="disguise-required-panel">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item
              label="请求伪装"
              prop="reqDisguiseId"
              required
            >
              <el-select
                v-model="puppet.reqDisguiseId"
                placeholder="请选择请求伪装"
                style="width: 100%"
                clearable
                filterable
              >
                <el-option
                  v-for="item in allDisguises"
                  :key="item.disguiseId"
                  :label="`${item.disguiseName} (${item.version})`"
                  :value="item.disguiseId"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item
              label="响应伪装"
              prop="respDisguiseId"
              required
            >
              <el-select
                v-model="puppet.respDisguiseId"
                placeholder="请选择响应伪装"
                style="width: 100%"
                clearable
                filterable
              >
                <el-option
                  v-for="item in allDisguises"
                  :key="item.disguiseId"
                  :label="`${item.disguiseName} (${item.version})`"
                  :value="item.disguiseId"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
      </div>

      <el-row :gutter="20">
        <el-col :span="24">
          <el-form-item
            label="请求头信息"
            prop="headers"
          >
            <el-input
              v-model="puppet.headers"
              type="textarea"
              :autosize="{ minRows: 4, maxRows: 8 }"
              placeholder="请输入请求头信息，格式：key: value"
              class="headers-textarea"
            />
          </el-form-item>
        </el-col>
      </el-row>

      <div class="section-heading section-heading--spaced">
        <div>
          <strong>连接策略</strong>
        </div>
      </div>

      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item
            prop="maxReqCount"
          >
            <template #label>
              <span class="field-label-with-help">
                最大请求数
                <el-tooltip
                  content="包含首次请求；1 表示不重试，3 表示最多重试 2 次。"
                  placement="top"
                >
                  <el-icon class="field-help-icon">
                    <Icon :icon="iconMap.infoCard" />
                  </el-icon>
                </el-tooltip>
              </span>
            </template>
            <el-input-number
              v-model="puppet.maxReqCount"
              :min="PUPPET_MIN_REQUEST_COUNT"
              :max="PUPPET_MAX_REQUEST_COUNT"
              placeholder="请输入最大请求数"
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="启用代理">
            <el-switch
              v-model="proxyEnabled"
              active-text="启用"
              inactive-text="禁用"
              inline-prompt
            />
          </el-form-item>
        </el-col>
      </el-row>

      <template v-if="proxyEnabled">
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item
              label="代理类型"
              prop="proxyType"
            >
              <el-select
                v-model="puppet.proxyType"
                placeholder="请选择代理类型"
                style="width: 100%"
              >
                <el-option
                  v-for="item in proxyOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item
              label="代理地址"
              prop="proxyHost"
            >
              <el-input
                v-model="puppet.proxyHost"
                placeholder="请输入代理地址"
                clearable
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item
              label="代理端口"
              prop="proxyPort"
            >
              <el-input-number
                v-model="puppet.proxyPort"
                :min="1"
                :max="65535"
                placeholder="端口"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </template>

      <PuppetStrategyFields
        v-model:url-strategy-enabled="urlStrategyEnabled"
        v-model:url-strategy-form="urlStrategyForm"
        v-model:padding-enabled="paddingEnabled"
        v-model:padding-preset="paddingPreset"
        v-model:padding-form="paddingForm"
        v-model:header-noise-enabled="headerNoiseEnabled"
        v-model:header-noise-form="headerNoiseForm"
        v-model:tls-fingerprint-enabled="tlsFingerprintEnabled"
        v-model:tls-fingerprint-form="tlsFingerprintForm"
        :probing="probing"
        @probe="handleProbe"
        @apply-padding-preset="applyPaddingPreset"
      />
    </div>
  </el-form>
</template>

<script setup>
import { ref, toRefs } from 'vue'
import { PUPPET_MAX_REQUEST_COUNT, PUPPET_MIN_REQUEST_COUNT } from '@/utils/constants.js'
import { icons } from '@/utils/icons.js'
import {
  PUPPET_PERMISSION_OPTIONS,
  PUPPET_PROTOCOL_OPTIONS,
  PUPPET_PROXY_OPTIONS,
  PUPPET_TYPE_OPTIONS
} from './puppetFormShared.js'
import PuppetStrategyFields from './PuppetStrategyFields.vue'

const props = defineProps({
  rules: { type: Object, required: true },
  disguises: { type: Array, default: () => [] },
  probing: { type: Boolean, default: false }
})
const { rules, disguises: allDisguises, probing } = toRefs(props)
const emit = defineEmits(['submit', 'probe', 'apply-padding-preset'])
const puppet = defineModel('puppet', { type: Object, required: true })
const proxyEnabled = defineModel('proxyEnabled', { type: Boolean, default: false })
const urlStrategyEnabled = defineModel('urlStrategyEnabled', { type: Boolean, default: false })
const urlStrategyForm = defineModel('urlStrategyForm', { type: Object, required: true })
const paddingEnabled = defineModel('paddingEnabled', { type: Boolean, default: false })
const paddingPreset = defineModel('paddingPreset', { type: String, default: '' })
const paddingForm = defineModel('paddingForm', { type: Object, required: true })
const headerNoiseEnabled = defineModel('headerNoiseEnabled', { type: Boolean, default: false })
const headerNoiseForm = defineModel('headerNoiseForm', { type: Object, required: true })
const tlsFingerprintEnabled = defineModel('tlsFingerprintEnabled', {
  type: Boolean,
  default: false
})
const tlsFingerprintForm = defineModel('tlsFingerprintForm', { type: Object, required: true })

const iconMap = icons
const permissions = PUPPET_PERMISSION_OPTIONS
const allProtocol = PUPPET_PROTOCOL_OPTIONS
const allTypes = PUPPET_TYPE_OPTIONS
const proxyOptions = PUPPET_PROXY_OPTIONS
const formRef = ref(null)
const handleProbe = () => emit('probe')
const applyPaddingPreset = (preset) => emit('apply-padding-preset', preset)

const validate = (...args) => formRef.value?.validate(...args)
const resetFields = (...args) => formRef.value?.resetFields(...args)
const clearValidate = (...args) => formRef.value?.clearValidate(...args)
const scrollToTop = () => {
  const formElement = formRef.value?.$el
  if (formElement) formElement.scrollTop = 0
}

defineExpose({ validate, resetFields, clearValidate, scrollToTop })
</script>

<style scoped>
@import '@/styles/puppet-form-dialog-shared.css';
</style>
