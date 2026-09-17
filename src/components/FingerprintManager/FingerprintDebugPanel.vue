<template>
  <section class="debug-panel">
    <p>使用所选会话发起真实 HTTP 请求，执行打开此面板时的草稿。结果保存在该会话的扫描任务中。</p>
    <el-form
      label-position="top"
      @submit.prevent="run"
    >
      <el-form-item label="执行会话">
        <el-select
          v-model="sessionId"
          filterable
          :loading="sessionsLoading"
          :disabled="pending || active"
          placeholder="选择执行扫描的会话"
        >
          <el-option
            v-for="session in sessions"
            :key="session.sessionId"
            :value="session.sessionId"
            :label="`${session.puppetName || '会话'} · ${session.sessionId}`"
          />
        </el-select>
        <el-button
          text
          :loading="sessionsLoading"
          @click="loadSessions"
        >
          刷新会话
        </el-button>
      </el-form-item>
      <p
        v-if="sessionsError"
        role="alert"
        class="error"
      >
        {{ sessionsError }}
      </p>
      <el-form-item label="应用根地址">
        <el-input
          v-model="target"
          :disabled="pending || active"
          placeholder="http://192.168.1.10:8080/app/"
        />
        <span class="hint">规则路径会拼接在此地址后。例如 /app/ 与规则 /info 将请求 /app/info。</span>
      </el-form-item>
      <div class="actions">
        <el-button
          type="primary"
          :loading="pending"
          :disabled="!sessionId || !target.trim() || active"
          @click="run"
        >
          开始调试
        </el-button>
        <el-button
          v-if="active"
          :loading="stopping"
          @click="stop"
        >
          停止
        </el-button>
        <el-button
          v-if="taskId"
          @click="refresh"
        >
          刷新进度
        </el-button>
      </div>
    </el-form>
    <p
      v-if="error"
      role="alert"
      class="error"
    >
      {{ error }}
    </p>
    <p v-if="summary">
      {{ outcomeText }} · {{ summary.progress || 0 }}% <span v-if="summary.error">· {{ summary.error }}</span>
    </p>
    <p v-if="fingerprintStage?.networkRequestCount != null">
      规则请求 {{ fingerprintStage.logicalRequestCount }} 次，合并后请求 {{ fingerprintStage.networkRequestCount }} 次，合并 {{ fingerprintStage.savedRequestCount }} 次。
    </p>
    <FingerprintResults
      v-if="taskId"
      :session-id="taskSessionId"
      :task-id="taskId"
      endpoint-id=""
      :refresh-token="refreshToken"
    />
  </section>
</template>

<script setup>
import { computed, onMounted, onScopeDispose, ref } from 'vue'
import { getSessionsApi } from '@/services/api.js'
import FingerprintResults from '@/components/PuppetConsole/Scan/FingerprintResults.vue'
import { useFingerprintDebug } from './useFingerprintDebug.js'

const props = defineProps({ fingerprint: { type: Object, required: true } })
const sessions = ref([])
const sessionsLoading = ref(false)
const sessionsError = ref('')
const sessionId = ref('')
const target = ref('')
const { taskId, taskSessionId, summary, pending, stopping, error, refreshToken, active, start, stop, refresh } = useFingerprintDebug()
const fingerprintStage = computed(() => summary.value?.stages?.find(stage => stage.name === 'FINGERPRINT'))
const outcomeText = computed(() => ({ COMPLETED: '调试完成', FAILED: '调试失败', CANCELLED: '已停止' })[summary.value?.outcome] || '正在调试')
let sequence = 0
async function loadSessions() {
  const current = ++sequence
  sessionsLoading.value = true
  sessionsError.value = ''
  try {
    const response = await getSessionsApi()
    if (current !== sequence) return
    sessions.value = Array.isArray(response.data) ? response.data : []
    if (!sessionId.value && sessions.value.length === 1) sessionId.value = sessions.value[0].sessionId
  } catch (cause) {
    if (current === sequence) sessionsError.value = cause?.message || '读取会话失败'
  } finally {
    if (current === sequence) sessionsLoading.value = false
  }
}
function run() { return start({ sessionId: sessionId.value, target: target.value.trim(), fingerprint: props.fingerprint }) }
onMounted(loadSessions)
onScopeDispose(() => { sequence += 1 })
</script>

<style scoped>
.debug-panel { max-height: 72vh; overflow: auto; padding: 0 4px; }
p, .hint { color: var(--el-text-color-secondary); font-size: 13px; line-height: 1.6; }
.el-select { flex: 1; }
.hint { margin-top: 6px; }
.actions { display: flex; gap: 8px; }
.error { color: var(--el-color-danger); }
</style>
