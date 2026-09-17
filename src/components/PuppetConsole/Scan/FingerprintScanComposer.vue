<template>
  <div>
    <p>对已选 {{ selection.endpoints.length }} 个 HTTP/HTTPS 资产执行组件识别，结果保存为独立任务。</p>
    <p class="targets">
      {{ selection.endpoints.map(row => `${row.host}:${row.port}`).join('、') }}
    </p>
    <FingerprintRuleSelector
      v-model="fingerprint"
      @validity-change="valid = $event"
    />
    <p
      v-if="error"
      role="alert"
      class="error"
    >
      {{ error }}
    </p>
    <el-button
      type="primary"
      :loading="pending"
      :disabled="!valid || pending"
      @click="start"
    >
      开始补扫
    </el-button>
  </div>
</template>

<script setup>
import { ref, onScopeDispose } from 'vue'
import { startNetworkFingerprintScanApi } from '@/services/api.js'
import FingerprintRuleSelector from './FingerprintRuleSelector.vue'

const props = defineProps({
  sessionId: { type: String, required: true },
  selection: { type: Object, required: true }
})
const emit = defineEmits(['scan-started'])
const fingerprint = ref({ ids: [], tags: [] })
const valid = ref(false)
const pending = ref(false)
const error = ref('')
let disposed = false
async function start() {
  if (!valid.value || pending.value) return
  const sessionId = props.sessionId
  const selection = props.selection
  pending.value = true
  error.value = ''
  try {
    const response = await startNetworkFingerprintScanApi({
      sessionId,
      sourceTaskId: selection.sourceTaskId,
      endpointIds: selection.endpoints.map(row => row.endpointId),
      fingerprint: fingerprint.value
    })
    if (!disposed && props.sessionId === sessionId) {
      emit('scan-started', {
        ...response.data,
        sessionId,
        scan: {
          name: '组件补扫',
          stages: ['FINGERPRINT'],
          targets: { items: [...new Set(selection.endpoints.map(row => row.host))] }
        }
      })
    }
  } catch (cause) {
    if (!disposed) error.value = cause?.message || '启动组件补扫失败'
  } finally {
    if (!disposed) pending.value = false
  }
}
onScopeDispose(() => { disposed = true })
</script>

<style scoped>
p { line-height: 1.6; }
.targets { max-height: 100px; overflow: auto; overflow-wrap: anywhere; color: var(--el-text-color-secondary); }
.error { color: var(--el-color-danger); }
</style>
