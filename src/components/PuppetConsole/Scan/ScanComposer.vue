<template>
  <div class="scan-composer">
    <el-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-position="top"
      class="composer-form"
    >
      <div class="stage-selection">
        <div
          class="stage-options"
          role="group"
          aria-label="扫描阶段"
        >
          <strong>扫描阶段</strong>
          <el-checkbox
            v-for="stage in SCAN_STAGES"
            :key="stage.name"
            :model-value="formData.stages.includes(stage.name)"
            @change="enabled => changeStage(stage.name, enabled)"
          >
            {{ stage.label }}
          </el-checkbox>
        </div>
        <p>{{ stageHint }}</p>
      </div>
      <div class="composer-layout">
        <el-form-item
          prop="targets"
          class="targets-field"
        >
          <TargetInput v-model="formData.targets" />
        </el-form-item>

        <div class="scan-settings">
          <PortPolicySelector
            v-show="scansPorts"
            v-model="formData.portPolicy"
            @validity-change="portPolicyValid = $event"
          />
          <details class="advanced-settings">
            <summary>高级设置 <span>名称、并发与超时</span></summary>
            <div class="name-field">
              <label for="scan-name">任务名称 <span>可选</span></label>
              <el-input
                id="scan-name"
                v-model="formData.name"
                placeholder="例如：生产网段周检"
                clearable
              />
            </div>
            <div class="execution-fields">
              <el-form-item label="并发数">
                <el-input-number
                  v-model="formData.concurrency"
                  :min="1"
                  :max="256"
                  :precision="0"
                  controls-position="right"
                />
              </el-form-item>
              <el-form-item label="连接超时">
                <div class="timeout-field">
                  <el-input-number
                    v-model="formData.connectTimeout"
                    :min="100"
                    :max="300000"
                    :step="100"
                    :precision="0"
                    controls-position="right"
                  />
                  <span>ms</span>
                </div>
              </el-form-item>
            </div>
          </details>
        </div>
      </div>

      <section
        class="scan-preview"
        :class="{ ready: previewData }"
        aria-label="执行预览"
        aria-live="polite"
      >
        <div class="preview-heading">
          <strong>执行预览</strong>
          <span>{{ previewing ? '正在计算…' : previewData ? '已就绪' : '待生成' }}</span>
        </div>
        <div
          v-if="previewData"
          class="preview-stats"
        >
          <div><span>主机</span><strong>{{ Number(previewData.hostCount || 0).toLocaleString('zh-CN') }}</strong></div>
          <div><span>{{ scansPorts ? '扫描端口' : '探活请求' }}</span><strong>{{ Number((scansPorts ? previewData.portCount : previewData.reachabilityProbeCount) || 0).toLocaleString('zh-CN') }}</strong></div>
          <div v-if="scansPorts">
            <span>检测组合</span><strong>{{ Number(previewData.combinationCount || 0).toLocaleString('zh-CN') }}</strong>
          </div>
          <div v-if="formData.stages.includes('SERVICE_PROBE')">
            <span>服务请求</span><strong>{{ Number(previewData.serviceProbeCount || 0).toLocaleString('zh-CN') }}</strong>
          </div>
          <div><span>预计结果</span><strong>{{ previewData.estimatedSize || '—' }}</strong></div>
        </div>
        <p
          v-else
          class="preview-hint"
        >
          填写目标后生成预览，确认扫描范围与探测规模。
        </p>
        <el-alert
          v-if="previewData?.warnings?.length"
          type="warning"
          :closable="false"
          class="preview-warning"
        >
          <ul>
            <li
              v-for="(warning, index) in previewData.warnings"
              :key="index"
            >
              {{ warning }}
            </li>
          </ul>
        </el-alert>
      </section>
    </el-form>

    <footer class="composer-footer">
      <div class="footer-actions">
        <el-button @click="handleCancel">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="previewing || starting"
          :disabled="!formData.targets.length || !formData.stages.length || (scansPorts && !portPolicyValid) || previewing || starting"
          @click="previewData ? handleStart() : handlePreview()"
        >
          <el-icon v-if="!previewing && !starting">
            <CaretRight />
          </el-icon>{{ previewData ? '开始扫描' : '生成预览' }}
        </el-button>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onScopeDispose, watch } from 'vue'
import { CaretRight } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import TargetInput from './TargetInput.vue'
import PortPolicySelector from './PortPolicySelector.vue'
import { SCAN_STAGES, toggleScanStage } from './scanStages.js'
import { previewNetworkProbeWorkflowApi, startNetworkProbeWorkflowApi } from '@/services/api.js'

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
  stages: SCAN_STAGES.map(stage => stage.name),
  portPolicy: {
    preset: 'QUICK',
    customPorts: [],
    excludePorts: []
  },
  concurrency: 256,
  connectTimeout: 1000
})

const portPolicyValid = ref(true)
const scansPorts = computed(() => formData.stages.includes('PORT_SCAN'))
const stageHint = computed(() => {
  if (!formData.stages.length) return '请至少选择一个扫描阶段。'
  if (!scansPorts.value) return '仅探活：使用常用 TCP 端口；输入主机:端口可指定探活端口。'
  const scope = formData.stages.includes('REACHABILITY') ? '先探活，仅扫描存活主机。' : '跳过探活，直接扫描所有输入目标。'
  return scope + (formData.stages.includes('SERVICE_PROBE') ? '识别开放端口上的服务。' : '仅检查端口开放状态。')
})
function changeStage(name, enabled) {
  formData.stages = toggleScanStage(formData.stages, name, enabled)
}

// 验证规则
const rules = {
  targets: [{ required: true, message: '请至少输入一个扫描目标', trigger: 'change' }]
}

// 状态
const previewing = ref(false)
const starting = ref(false)
const previewData = ref(null)
let previewSequence = 0
let disposed = false
onScopeDispose(() => {
  disposed = true
  previewSequence += 1
})

watch(
  () => [
    props.sessionId,
    formData.targets,
    formData.stages,
    formData.portPolicy,
    portPolicyValid.value,
    formData.concurrency,
    formData.connectTimeout
  ],
  () => {
    previewSequence += 1
    previewData.value = null
  },
  { deep: true, flush: 'sync' }
)

// 方法
async function handlePreview() {
  if (previewing.value || starting.value) return
  const sequence = ++previewSequence
  previewing.value = true
  previewData.value = null
  try {
    if (!(await formRef.value.validate().catch(() => false))) return
    if (disposed || sequence !== previewSequence || !validateTargets()) return
    const response = await previewNetworkProbeWorkflowApi({
      sessionId: props.sessionId,
      scan: buildScanConfig()
    })
    if (disposed || sequence !== previewSequence) return
    const payload = response.data || {}
    const plannedStages = payload.preview?.stages || SCAN_STAGES.map(stage => stage.name)
    if (payload.preview && plannedStages.join(',') !== formData.stages.join(',')) {
      ElMessage.warning('服务端尚未支持当前阶段配置，请更新服务端后重试')
      return
    }
    previewData.value = payload.errors?.length ? null : payload.preview || null
    if (payload.errors?.length) ElMessage.warning(payload.errors.join('；'))
  } catch (error) {
    if (!disposed && sequence === previewSequence)
      ElMessage.error('预览失败: ' + (error?.message || '未知错误'))
  } finally {
    previewing.value = false
  }
}

async function handleStart() {
  if (starting.value || previewing.value || !previewData.value) return
  const sessionId = props.sessionId
  const sequence = previewSequence
  starting.value = true
  try {
    if (!(await formRef.value.validate().catch(() => false))) return
    if (disposed || sequence !== previewSequence || !validateTargets()) return
    const config = buildScanConfig()
    const response = await startNetworkProbeWorkflowApi({ sessionId, scan: config })
    if (!disposed && props.sessionId === sessionId) {
      emit('scan-started', { ...(response.data || {}), sessionId, scan: config })
    }
  } catch (error) {
    if (!disposed && props.sessionId === sessionId)
      ElMessage.error('启动失败: ' + (error?.message || '未知错误'))
  } finally {
    starting.value = false
  }
}

function handleCancel() {
  emit('cancel')
}

function validateTargets() {
  if (scansPorts.value && !portPolicyValid.value) {
    ElMessage.warning('请修正端口配置')
    return false
  }
  if (!formData.stages.length) {
    ElMessage.warning('请至少选择一个扫描阶段')
    return false
  }
  if (formData.targets.length > 0) return true
  ElMessage.warning('请至少输入一个扫描目标')
  return false
}

function buildScanConfig() {
  return {
    name: formData.name || undefined,
    stages: [...formData.stages],
    targets: {
      items: formData.targets.map((target) => target.input),
      exclude: []
    },
    portPolicy: scansPorts.value ? {
      profile: String(formData.portPolicy.preset || 'STANDARD').toLowerCase(),
      ranges: [],
      include: formData.portPolicy.preset === 'CUSTOM' ? formData.portPolicy.customPorts || [] : [],
      exclude: formData.portPolicy.excludePorts || []
    } : undefined,
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
  display: flex;
  flex-direction: column;
  min-height: 0;
  max-height: calc(92dvh - 64px);
  color: var(--el-text-color-primary);
  background: var(--el-bg-color-overlay);
}

.composer-form {
  min-height: 0;
  overflow-y: auto;
  padding: 20px;
}

.stage-selection { margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid var(--el-border-color-lighter); }
.stage-options { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 20px; }
.stage-options > strong { font-size: 12px; font-weight: 600; }
.stage-options :deep(.el-checkbox) { height: 24px; margin-right: 0; }
.stage-selection p { margin: 6px 0 0; color: var(--el-text-color-secondary); font-size: 11px; line-height: 1.5; }

.composer-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  align-items: start;
  gap: 22px;
}

.targets-field { min-width: 0; margin: 0; }
.targets-field :deep(.el-form-item__content) { display: block; line-height: normal; }

.scan-settings {
  display: grid;
  gap: 18px;
  min-width: 0;
  padding-left: 22px;
  border-left: 1px solid var(--el-border-color-lighter);
}

.advanced-settings summary { cursor: pointer; font-size: 12px; font-weight: 600; }
.advanced-settings summary span { margin-left: 6px; color: var(--el-text-color-secondary); font-size: 11px; font-weight: 400; }
.advanced-settings[open] summary { margin-bottom: 16px; }
.name-field { margin-bottom: 16px; }
.name-field label {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
}
.name-field label span { color: var(--el-text-color-placeholder); font-size: 11px; font-weight: 400; }

.execution-fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}
.execution-fields :deep(.el-form-item) { min-width: 0; margin: 0; }
.execution-fields :deep(.el-form-item__label) { height: auto; margin-bottom: 8px; line-height: 1.4; font-size: 12px; font-weight: 600; }
.execution-fields :deep(.el-input-number) { width: 100%; min-width: 0; }
.timeout-field { display: flex; align-items: center; gap: 7px; width: 100%; }
.timeout-field > span { flex-shrink: 0; color: var(--el-text-color-secondary); font-size: 12px; }

.scan-preview {
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr);
  align-items: center;
  column-gap: 18px;
  margin-top: 20px;
  padding: 13px 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-fill-color-light);
}
.preview-heading { display: grid; gap: 5px; }
.preview-heading strong { font-size: 12px; font-weight: 600; }
.preview-heading > span { color: var(--el-text-color-secondary); font-size: 11px; }
.ready .preview-heading > span { color: var(--el-color-success); }
.preview-hint { margin: 0; color: var(--el-text-color-secondary); font-size: 12px; line-height: 1.6; }
.preview-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(70px, 1fr)); gap: 12px; }
.preview-stats > div { display: grid; gap: 5px; }
.preview-stats span { color: var(--el-text-color-secondary); font-size: 11px; }
.preview-stats strong { font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.preview-warning { grid-column: 1 / -1; margin-top: 12px; }
.preview-warning ul { margin: 0; padding-left: 16px; font-size: 12px; }

.composer-footer {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
  padding: 12px 20px;
  border-top: 1px solid var(--el-border-color-lighter);
}
.footer-actions { display: flex; flex-shrink: 0; gap: 8px; }
.footer-actions :deep(.el-button + .el-button) { margin-left: 0; }
.footer-actions :deep(.el-icon) { margin-right: 4px; }

@media (max-width: 680px) {
  .composer-form { padding: 16px; }
  .composer-layout { grid-template-columns: minmax(0, 1fr); gap: 20px; }
  .scan-settings { padding-left: 0; border-left: 0; }
  .scan-preview { grid-template-columns: 1fr; gap: 12px; padding: 12px; }
  .preview-heading { display: flex; align-items: center; justify-content: space-between; }
  .preview-stats { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .composer-footer { padding: 12px 16px; }
}
</style>
