<template>
  <div class="scan-composer">
    <el-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-position="top"
      class="composer-form"
    >
      <section class="form-section identity-section">
        <div class="section-heading">
          <span>任务名称</span>
          <span class="section-note">可选</span>
        </div>
        <el-form-item label="" prop="name">
          <el-input
            v-model="formData.name"
            placeholder="例如：生产网段周检"
            clearable
          />
        </el-form-item>
      </section>

      <section class="form-section target-section">
        <div class="section-heading">
          <span>扫描目标</span>
          <span class="target-count"><strong>{{ formData.targets.length.toLocaleString('zh-CN') }}</strong> 个目标</span>
        </div>
        <TargetInput
          v-model="formData.targets"
        />
      </section>

        <section class="form-section config-section">
          <div class="config-block port-block">
            <PortPolicySelector v-model="formData.portPolicy" />
          </div>

        <button type="button" class="advanced-trigger" @click="showAdvanced = !showAdvanced">
          <span>高级设置</span>
          <span class="advanced-trigger-state">{{ showAdvanced ? '收起' : '展开' }}</span>
        </button>
        <el-collapse-transition>
          <div v-show="showAdvanced" class="advanced-options">
            <el-form-item label="并发度">
              <el-slider
                v-model="formData.concurrency"
                :min="1"
                :max="100"
                show-input
              />
            </el-form-item>

            <el-form-item label="超时设置">
              <el-input-number
                v-model="formData.connectTimeout"
                :min="100"
                :max="300000"
                :step="100"
              />
              <span class="input-suffix">ms，连接和识别共用</span>
            </el-form-item>
          </div>
        </el-collapse-transition>
      </section>

      <section v-if="previewData" class="preview-panel">
        <div class="section-heading">
          <span>扫描预览</span>
          <span class="section-note">提交前确认</span>
        </div>
        <div class="preview-stats">
          <div><strong>{{ Number(previewData.hostCount || 0).toLocaleString('zh-CN') }}</strong><span>目标</span></div>
          <div><strong>{{ Number(previewData.reachabilityProbeCount || 0).toLocaleString('zh-CN') }}</strong><span>探活请求</span></div>
          <div><strong>{{ Number(previewData.portCount || 0).toLocaleString('zh-CN') }}</strong><span>端口</span></div>
          <div><strong>{{ Number(previewData.combinationCount || 0).toLocaleString('zh-CN') }}</strong><span>检测组合</span></div>
          <div><strong>{{ Number(previewData.serviceProbeCount || 0).toLocaleString('zh-CN') }}</strong><span>深度请求</span></div>
          <div><strong>{{ previewData.estimatedSize || '-' }}</strong><span>预计结果</span></div>
        </div>
        <el-alert
          v-if="(previewData.warnings || []).length > 0"
          type="warning"
          :closable="false"
          class="preview-warning"
        >
          <ul class="warning-list">
            <li v-for="(warning, idx) in (previewData.warnings || [])" :key="idx">{{ warning }}</li>
          </ul>
        </el-alert>
      </section>
    </el-form>

    <div class="composer-footer">
      <el-button @click="handleCancel">取消</el-button>
      <el-button @click="handlePreview" :loading="previewing">
        <el-icon><View /></el-icon>
        预览扫描
      </el-button>
      <el-button
        type="primary"
        @click="handleStart"
        :loading="starting"
        :disabled="!canStart"
      >
        <el-icon><CaretRight /></el-icon>
        开始扫描
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { View, CaretRight } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import TargetInput from './TargetInput.vue'
import PortPolicySelector from './PortPolicySelector.vue'
import {
  previewNetworkProbeWorkflowApi,
  startNetworkProbeWorkflowApi
} from '@/services/api.js'

const props = defineProps({
  sessionId: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['scan-started', 'cancel'])

// 表单数据
const formRef = ref(null)
const formData = reactive({
  name: '',
  targets: [],
  portPolicy: {
    preset: 'STANDARD',
    customPorts: [],
    excludePorts: []
  },
  concurrency: 10,
  connectTimeout: 2000
})

// 验证规则
const rules = {
  targets: [
    { required: true, message: '请至少输入一个扫描目标', trigger: 'change' }
  ]
}

// 状态
const showAdvanced = ref(false)
const previewing = ref(false)
const starting = ref(false)
const previewData = ref(null)

// 计算属性
const canStart = computed(() => {
  return formData.targets.length > 0 && !starting.value
})

// 方法
async function handlePreview() {
  try {
    await formRef.value.validate()
    if (!validateTargets()) return
    previewing.value = true

    const config = buildScanConfig()
    const response = await previewNetworkProbeWorkflowApi({
      sessionId: props.sessionId,
      scan: config
    })

    const payload = response.data || {}
    previewData.value = payload.preview || null
    if (payload.errors?.length) ElMessage.warning(payload.errors.join('；'))
  } catch (error) {
    if (error.errors) {
      // 验证错误，不显示消息
      return
    }
    ElMessage.error('预览失败: ' + (error.message || '未知错误'))
  } finally {
    previewing.value = false
  }
}

async function handleStart() {
  try {
    await formRef.value.validate()
    if (!validateTargets()) return
    starting.value = true

    const config = buildScanConfig()
    const response = await startNetworkProbeWorkflowApi({
      sessionId: props.sessionId,
      scan: config
    })

    emit('scan-started', { ...(response.data || {}), scan: config })
  } catch (error) {
    if (error.errors) {
      return
    }
    ElMessage.error('启动失败: ' + (error.message || '未知错误'))
  } finally {
    starting.value = false
  }
}

function handleCancel() {
  emit('cancel')
}

function validateTargets() {
  if (formData.targets.length > 0) return true
  ElMessage.warning('请至少输入一个扫描目标')
  return false
}

function buildScanConfig() {
  return {
    name: formData.name || undefined,
    targets: {
      items: formData.targets.map(target => target.input),
      exclude: []
    },
    portPolicy: {
      profile: String(formData.portPolicy.preset || 'STANDARD').toLowerCase(),
      ranges: [],
      include: formData.portPolicy.preset === 'CUSTOM'
        ? (formData.portPolicy.customPorts || [])
        : [],
      exclude: formData.portPolicy.excludePorts || [],
    },
    execution: {
      workers: formData.concurrency,
      timeoutMs: formData.connectTimeout
    },
    fingerprint: {
      tags: [],
      ids: []
    }
  }
}

defineExpose({
  validate: () => formRef.value.validate()
})
</script>

<style scoped lang="scss">
.scan-composer { --ink: #17212b; --muted: #7d8995; height: 100%; display: flex; flex-direction: column; overflow: hidden; color: var(--ink); background: #fff; }
.composer-form { flex: 1; overflow-y: auto; padding: 24px 30px 36px; }
.form-section, .preview-panel { margin: 0; padding: 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
.form-section + .form-section, .preview-panel { margin-top: 32px; }
.section-heading, .field-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; color: #2f3b47; font-size: 13px; font-weight: 650; }
.section-note, .field-note { color: #9aa5af; font-size: 11px; font-weight: 400; }
.target-count { color: #8996a3; font-size: 11px; font-weight: 400; }
.target-count strong { color: #2563eb; font-size: 15px; font-weight: 650; }
.identity-section :deep(.el-form-item), .target-section :deep(.el-form-item), .config-block :deep(.el-form-item) { margin-bottom: 0; }
.config-block { min-width: 0; }
.port-block :deep(.el-radio-group) { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); width: 100%; }
.port-block :deep(.el-radio-button__inner) { width: 100%; padding-left: 5px; padding-right: 5px; }
.advanced-trigger { width: 100%; display: flex; align-items: center; justify-content: space-between; margin-top: 20px; padding: 0; border: 0; color: #53616e; background: transparent; cursor: pointer; font-size: 12px; text-align: left; }
.advanced-trigger-state { color: #2563eb; }
.advanced-options { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 18px 28px; padding-top: 18px; }
.advanced-options :deep(.el-form-item) { margin-bottom: 0; }
.advanced-options .input-suffix { margin-left: 8px; color: #606266; font-size: 12px; }
.advanced-options :deep(.el-checkbox-group) { display: flex; flex-wrap: wrap; gap: 6px 18px; }
.preview-panel { padding-top: 0; }
.preview-stats { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 18px; }
.preview-stats div { min-width: 0; }
.preview-stats strong, .preview-stats span { display: block; }
.preview-stats strong { overflow: hidden; color: #1d4ed8; font-size: 17px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.preview-stats span { margin-top: 4px; color: #8996a3; font-size: 10px; }
.preview-warning { margin-top: 12px; }
.warning-list { margin: 0; padding-left: 18px; }
.warning-list li { margin: 2px 0; font-size: 12px; }
.composer-footer { display: flex; justify-content: flex-end; gap: 12px; padding: 14px 30px 18px; background: #fff; box-shadow: 0 -8px 18px rgba(31, 52, 73, .05); }
@media (max-width: 640px) {
  .composer-form, .composer-footer { padding-left: 16px; padding-right: 16px; }
  .advanced-options, .preview-stats { grid-template-columns: 1fr; }
}
</style>
