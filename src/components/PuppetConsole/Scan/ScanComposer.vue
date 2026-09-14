<template>
  <div class="scan-composer">
    <div class="composer-intro">
      <div>
        <h2>配置一次网络资产发现</h2>
      </div>
    </div>

    <el-form ref="formRef" :model="formData" :rules="rules" label-position="top" class="composer-form">
      <div class="composer-layout">
        <div class="config-column">
          <section class="config-section">
            <div class="section-heading"><div><span class="section-index">01</span><strong>扫描目标</strong></div><span class="section-note">{{ formData.targets.length.toLocaleString('zh-CN') }} 个有效目标</span></div>
            <el-form-item prop="targets">
              <TargetInput v-model="formData.targets" />
            </el-form-item>
          </section>

          <section class="config-section">
            <div class="section-heading"><div><span class="section-index">02</span><strong>扫描策略</strong></div></div>
            <div class="name-field">
              <label for="scan-name">任务名称 <small>可选</small></label>
              <el-input id="scan-name" v-model="formData.name" placeholder="例如：生产网段周检" clearable />
            </div>
            <PortPolicySelector v-model="formData.portPolicy" />
          </section>

          <section class="config-section">
            <div class="section-heading"><div><span class="section-index">03</span><strong>执行参数</strong></div><span class="section-note">高级设置</span></div>
            <div class="execution-grid">
              <el-form-item label="并发度">
                <el-slider v-model="formData.concurrency" :min="1" :max="256" show-input />
              </el-form-item>
              <el-form-item label="连接超时">
                <div class="timeout-field"><el-input-number v-model="formData.connectTimeout" :min="100" :max="300000" :step="100" controls-position="right" /><span>ms</span></div>
              </el-form-item>
            </div>
          </section>
        </div>

        <aside class="plan-column">
          <div class="plan-card">
            <div class="plan-heading"><div><h3>执行预览</h3></div><span class="plan-state" :class="{ ready: previewData }">{{ previewData ? '已生成' : '待生成' }}</span></div>
            <div class="plan-target"><span>任务</span><strong>{{ formData.name || '网络资产发现' }}</strong><em>{{ targetSummary }}</em></div>
            <div class="pipeline"><div v-for="(stage, index) in ['主机探活', '端口扫描', '服务识别']" :key="stage" class="pipeline-row"><span>{{ String(index + 1).padStart(2, '0') }}</span><i></i><strong>{{ stage }}</strong></div></div>
            <template v-if="previewData">
              <div class="plan-stats">
                <div><strong>{{ Number(previewData.hostCount || 0).toLocaleString('zh-CN') }}</strong><span>目标</span></div>
                <div><strong>{{ Number(previewData.portCount || 0).toLocaleString('zh-CN') }}</strong><span>端口</span></div>
                <div><strong>{{ Number(previewData.combinationCount || 0).toLocaleString('zh-CN') }}</strong><span>检测组合</span></div>
                <div><strong>{{ Number(previewData.serviceProbeCount || 0).toLocaleString('zh-CN') }}</strong><span>深度请求</span></div>
              </div>
              <div class="plan-estimate"><span>预计结果规模</span><strong>{{ previewData.estimatedSize || '-' }}</strong></div>
              <el-alert v-if="(previewData.warnings || []).length" type="warning" :closable="false" class="preview-warning"><ul><li v-for="(warning, index) in previewData.warnings" :key="index">{{ warning }}</li></ul></el-alert>
            </template>
            <div v-else class="plan-placeholder"><span>暂无预览</span></div>
          </div>
        </aside>
      </div>
    </el-form>

    <footer class="composer-footer">
      <el-button @click="handleCancel">取消</el-button>
      <el-button type="primary" :loading="previewing || starting" :disabled="!formData.targets.length" @click="previewData ? handleStart() : handlePreview()">
        <el-icon><CaretRight /></el-icon>{{ previewData ? '开始扫描' : '生成预览' }}
      </el-button>
    </footer>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { CaretRight } from '@element-plus/icons-vue'
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
    preset: 'QUICK',
    customPorts: [],
    excludePorts: []
  },
  concurrency: 256,
  connectTimeout: 1000
})

// 验证规则
const rules = {
  targets: [
    { required: true, message: '请至少输入一个扫描目标', trigger: 'change' }
  ]
}

// 状态
const previewing = ref(false)
const starting = ref(false)
const previewData = ref(null)

// 计算属性
const canStart = computed(() => {
  return formData.targets.length > 0 && previewData.value && !starting.value
})

const targetSummary = computed(() => {
  const first = formData.targets[0]?.input || '未设置目标'
  const suffix = formData.targets.length > 1 ? ` 等 ${formData.targets.length.toLocaleString('zh-CN')} 个目标` : ''
  return `${first}${suffix}`
})

watch(
  () => [formData.targets, formData.portPolicy, formData.concurrency, formData.connectTimeout],
  () => {
    if (previewData.value) previewData.value = null
  },
  { deep: true }
)

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
    if (error.errors) return
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
    }
  }
}

defineExpose({
  validate: () => formRef.value.validate()
})
</script>

<style scoped lang="scss">
.scan-composer {
  --ink: #1f2937;
  --muted: #6b7280;
  --subtle: #9ca3af;
  --line: #e5e7eb;
  --blue: #2563eb;
  display: flex;
  flex-direction: column;
  height: 100%;
  color: var(--ink);
  background: #fff;
}

.composer-intro {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: 22px 28px 20px;
  border-bottom: 1px solid var(--line);
}

.eyebrow {
  color: var(--blue);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .11em;
}

.composer-intro h2 {
  margin: 6px 0 7px;
  font-size: 19px;
  font-weight: 650;
}

.composer-intro p {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
}

.intro-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 9px;
  border-radius: 5px;
  color: #1d4ed8;
  background: #eff6ff;
  font-size: 11px;
  white-space: nowrap;
}

.composer-form {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 24px 28px 32px;
}

.composer-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  align-items: start;
  gap: 26px;
  max-width: 1040px;
  margin: 0 auto;
}

.config-column {
  min-width: 0;
}

.config-section {
  padding: 0 0 25px;
  border-bottom: 1px solid #eef0f2;
}

.config-section + .config-section {
  margin-top: 25px;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.section-heading > div {
  display: flex;
  align-items: center;
  gap: 9px;
}

.section-index {
  color: var(--blue);
  font-family: monospace;
  font-size: 11px;
  font-weight: 700;
}

.section-heading strong {
  font-size: 14px;
  font-weight: 650;
}

.section-note {
  color: var(--subtle);
  font-size: 11px;
}

.name-field {
  margin-bottom: 18px;
}

.name-field label {
  display: block;
  margin-bottom: 7px;
  color: #4b5563;
  font-size: 11px;
  font-weight: 600;
}

.name-field label small {
  margin-left: 5px;
  color: var(--subtle);
  font-weight: 400;
}

.execution-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
}

.execution-grid :deep(.el-form-item) {
  margin-bottom: 0;
}

.execution-grid :deep(.el-slider) {
  padding: 0 7px;
}

.field-help {
  display: block;
  margin-top: 7px;
  color: var(--subtle);
  font-size: 10px;
  line-height: 1.5;
}

.timeout-field {
  display: flex;
  align-items: center;
  gap: 8px;
}

.timeout-field :deep(.el-input-number) {
  width: 150px;
}

.timeout-field > span {
  color: var(--muted);
  font-size: 12px;
}

.plan-column {
  position: sticky;
  top: 0;
}

.plan-card {
  padding: 17px;
  border: 1px solid #dbe4ee;
  border-radius: 6px;
  background: #fbfcfe;
}

.plan-heading,
.plan-heading > div,
.plan-target,
.plan-estimate {
  display: flex;
  align-items: center;
}

.plan-heading {
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 13px;
  border-bottom: 1px solid var(--line);
}

.plan-heading > div {
  align-items: flex-start;
  flex-direction: column;
  gap: 4px;
}

.plan-heading h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 650;
}

.plan-state {
  padding: 3px 7px;
  border-radius: 4px;
  color: var(--muted);
  background: #f0f2f4;
  font-size: 10px;
}

.plan-state.ready {
  color: #047857;
  background: #ecfdf5;
}

.plan-target {
  align-items: flex-start;
  flex-direction: column;
  gap: 4px;
  padding: 14px 0;
}

.plan-target span,
.plan-target em,
.plan-estimate span {
  color: var(--subtle);
  font-size: 10px;
  font-style: normal;
}

.plan-target strong {
  max-width: 100%;
  overflow: hidden;
  font-size: 13px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plan-target em {
  max-width: 100%;
  overflow: hidden;
  color: #64748b;
  font-family: monospace;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pipeline {
  padding: 12px 0;
  border-top: 1px solid #eef0f2;
  border-bottom: 1px solid #eef0f2;
}

.pipeline-row {
  display: grid;
  grid-template-columns: 22px 12px minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  min-height: 27px;
}

.pipeline-row span {
  color: var(--subtle);
  font-family: monospace;
  font-size: 10px;
}

.pipeline-row i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #9dbcf8;
}

.pipeline-row strong {
  color: #4b5563;
  font-size: 11px;
  font-weight: 550;
}

.plan-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1px;
  margin-top: 14px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--line);
}

.plan-stats div {
  padding: 9px;
  background: #fff;
}

.plan-stats strong,
.plan-stats span {
  display: block;
}

.plan-stats strong {
  color: var(--blue);
  font-size: 16px;
  font-weight: 650;
}

.plan-stats span {
  margin-top: 3px;
  color: var(--subtle);
  font-size: 10px;
}

.plan-estimate {
  justify-content: space-between;
  gap: 10px;
  margin-top: 12px;
}

.plan-estimate strong {
  color: #374151;
  font-size: 12px;
  font-weight: 600;
}

.plan-placeholder {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 18px 0 2px;
  color: var(--subtle);
  font-size: 11px;
  line-height: 1.5;
}

.plan-placeholder .el-icon {
  color: #9dbcf8;
}

.preview-warning {
  margin-top: 12px;
}

.preview-warning :deep(.el-alert__content) {
  padding: 0;
}

.preview-warning ul {
  margin: 0;
  padding-left: 16px;
}

.preview-warning li {
  font-size: 11px;
}

.composer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 28px 18px;
  border-top: 1px solid var(--line);
  background: #fff;
}

@media (max-width: 760px) {
  .composer-intro,
  .composer-form {
    padding-right: 16px;
    padding-left: 16px;
  }

  .composer-intro {
    flex-direction: column;
    gap: 12px;
  }

  .composer-layout {
    grid-template-columns: 1fr;
  }

  .plan-column {
    position: static;
    grid-row: 1;
  }

  .config-column {
    grid-row: 2;
  }

  .execution-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .composer-footer {
    padding-right: 16px;
    padding-left: 16px;
  }
}
</style>
