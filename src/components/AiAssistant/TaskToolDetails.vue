<template>
  <div
    class="tool-body"
    :class="{ 'is-danger': node.status === 'failed' || node.success === false }"
  >
    <div
      v-if="formattedArgs"
      class="tool-section"
    >
      <div class="tool-section-title">
        参数
      </div>
      <pre class="tool-code">{{ formattedArgs }}</pre>
    </div>
    <div
      v-if="formattedResult"
      class="tool-section"
    >
      <div class="tool-section-title">
        结果
      </div>
      <pre class="tool-code tool-code--result">{{ formattedResult }}</pre>
      <div
        v-if="shellResultId"
        class="shell-fetch-row"
      >
        <button
          class="shell-fetch-btn"
          :disabled="loading"
          @click="fetchShellResult"
        >
          <Icon
            v-if="loading"
            icon="mdi:loading"
            class="spin-icon"
          />
          <Icon
            v-else
            icon="mdi:download-outline"
          />
          {{ loading ? '取回中…' : '取回完整代码' }}
        </button>
        <span
          v-if="error"
          class="shell-fetch-error"
        >{{ error }}</span>
      </div>
      <div
        v-if="workspaceFile"
        class="shell-fetch-row"
      >
        <button
          class="shell-fetch-btn"
          :disabled="workspaceLoading"
          @click="downloadWorkspaceFile"
        >
          <Icon
            v-if="workspaceLoading"
            icon="mdi:loading"
            class="spin-icon"
          />
          <Icon
            v-else
            icon="mdi:file-download-outline"
          />
          {{ workspaceLoading ? '下载中…' : `下载 ${workspaceFile.filename}` }}
        </button>
        <span class="workspace-file-meta">
          {{ workspaceFile.path }}
        </span>
        <span
          v-if="workspaceError"
          class="shell-fetch-error"
        >{{ workspaceError }}</span>
      </div>
      <div
        v-if="content"
        class="shell-fetch-result"
      >
        <div class="shell-fetch-result-header">
          <span class="shell-fetch-result-label">完整代码</span>
          <button
            class="shell-copy-btn"
            @click="copyShellResult"
          >
            <Icon :icon="copied ? 'mdi:check' : 'mdi:content-copy'" />
            {{ copied ? '已复制' : '复制' }}
          </button>
        </div>
        <pre class="tool-code tool-code--result shell-code-block">{{ content }}</pre>
      </div>
    </div>
    <div
      v-if="node.error"
      class="tool-section tool-error"
    >
      <Icon icon="mdi:alert-circle-outline" />
      <span>{{ node.error }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { getShellResultApi } from '@/services/api/shell-generator.js'
import { userFileDownloadApi } from '@/services/api/user-space.js'
import { createLatestRequestGuard } from '@/utils/latestRequestGuard.js'
import { downloadBlob } from '@/utils/downloadBlob.js'
import { formatToolValue, getShellResultId, getWorkspaceFileRef } from './taskNodeModel.js'

const props = defineProps({
  node: { type: Object, required: true }
})

const formattedArgs = computed(() => formatToolValue(props.node.args))
const formattedResult = computed(() => formatToolValue(props.node.result, 2000))
const shellResultId = computed(() => getShellResultId(props.node.result))
const workspaceFile = computed(() => getWorkspaceFileRef(props.node.result))
const loading = ref(false)
const workspaceLoading = ref(false)
const workspaceError = ref('')
const content = ref('')
const error = ref('')
const copied = ref(false)
const requestGuard = createLatestRequestGuard(['fetch'])
let copyResetTimer = null

watch(shellResultId, () => {
  requestGuard.invalidate()
  loading.value = false
  content.value = ''
  error.value = ''
  copied.value = false
})

watch(workspaceFile, () => {
  workspaceLoading.value = false
  workspaceError.value = ''
})

const fetchShellResult = async () => {
  const resultId = shellResultId.value
  if (!resultId || loading.value) return
  const sequence = requestGuard.next('fetch')
  loading.value = true
  error.value = ''
  try {
    const response = await getShellResultApi(resultId)
    if (!requestGuard.isCurrent('fetch', sequence) || resultId !== shellResultId.value) return
    const data = response.data
    content.value = String(data?.content || '')
    if (!content.value) error.value = '返回数据为空'
  } catch (fetchError) {
    if (requestGuard.isCurrent('fetch', sequence)) {
      error.value = fetchError?.message || '取回失败'
    }
  } finally {
    if (requestGuard.isCurrent('fetch', sequence)) loading.value = false
  }
}

const copyShellResult = async () => {
  if (!content.value) return
  try {
    const clipboard = globalThis.navigator?.clipboard
    if (typeof clipboard?.writeText !== 'function') throw new Error('clipboard unavailable')
    await clipboard.writeText(content.value)
    copied.value = true
    if (copyResetTimer !== null) window.clearTimeout(copyResetTimer)
    copyResetTimer = window.setTimeout(() => {
      copied.value = false
      copyResetTimer = null
    }, 2000)
  } catch {
    copied.value = false
  }
}

const downloadWorkspaceFile = async () => {
  const file = workspaceFile.value
  if (!file || workspaceLoading.value) return
  workspaceLoading.value = true
  workspaceError.value = ''
  try {
    const response = await userFileDownloadApi({ path: file.path })
    const blob = response?.data instanceof Blob ? response.data : new Blob([response?.data])
    downloadBlob(blob, file.filename)
  } catch (downloadError) {
    workspaceError.value = downloadError?.message || '下载失败'
  } finally {
    workspaceLoading.value = false
  }
}

onUnmounted(() => {
  requestGuard.invalidate()
  if (copyResetTimer !== null) window.clearTimeout(copyResetTimer)
})
</script>

<style scoped>
.tool-body {
  border-top: 0;
  margin: 2px 4px 7px 34px;
  padding: 4px 0 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tool-section-title {
  margin-bottom: 4px;
  color: var(--el-text-color-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.tool-code {
  max-height: 320px;
  margin: 0;
  padding: 8px 10px;
  overflow: auto;
  border-radius: 6px;
  background: color-mix(in srgb, var(--el-text-color-primary) 4%, transparent);
  color: var(--el-text-color-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11.5px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
}

.tool-code--result {
  background: color-mix(in srgb, var(--el-color-success) 5%, transparent);
}

.tool-body.is-danger .tool-code--result {
  background: color-mix(in srgb, var(--el-color-danger) 5%, transparent);
}

.tool-error {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  color: var(--el-color-danger);
  font-size: 12px;
}

.shell-fetch-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.shell-fetch-btn,
.shell-copy-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border-radius: 6px;
  cursor: pointer;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  line-height: 1.6;
}

.shell-fetch-btn {
  padding: 4px 12px;
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 40%, transparent);
  background: color-mix(in srgb, var(--el-color-primary) 8%, transparent);
  color: var(--el-color-primary);
  font-size: 12px;
}

.shell-fetch-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--el-color-primary) 16%, transparent);
  border-color: color-mix(in srgb, var(--el-color-primary) 60%, transparent);
}

.shell-fetch-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.shell-fetch-error {
  color: var(--el-color-danger);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11.5px;
}

.workspace-file-meta {
  min-width: 0;
  overflow: hidden;
  color: var(--el-text-color-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shell-fetch-result {
  margin-top: 8px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 18%, transparent);
  border-radius: 6px;
}

.shell-fetch-result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 10px;
  border-bottom: 1px solid color-mix(in srgb, var(--el-color-primary) 12%, transparent);
  background: color-mix(in srgb, var(--el-color-primary) 6%, transparent);
}

.shell-fetch-result-label {
  color: var(--el-color-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.shell-copy-btn {
  padding: 2px 8px;
  border: 1px solid color-mix(in srgb, var(--el-text-color-primary) 14%, transparent);
  background: color-mix(in srgb, var(--el-text-color-primary) 5%, transparent);
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.shell-copy-btn:hover {
  background: color-mix(in srgb, var(--el-text-color-primary) 10%, transparent);
  color: var(--el-text-color-primary);
}

.shell-code-block {
  max-height: 400px;
  border: 0;
  border-left: 2px solid color-mix(in srgb, var(--el-color-primary) 35%, transparent);
  border-radius: 0;
}

.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
