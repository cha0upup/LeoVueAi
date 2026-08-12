<template>
  <div class="test-panel">
    <div class="test-input-row">
      <span class="test-input-label">测试参数 (JSON)</span>
      <el-input
        v-model="paramsText"
        size="small"
        class="test-input"
        placeholder="{&quot;testKey&quot;:&quot;hello&quot;}"
        clearable
      />
      <el-button
        size="small"
        :loading="loading"
        type="primary"
        plain
        @click="emit('run')"
      >
        <el-icon><Icon :icon="icons.test" /></el-icon>
        运行
      </el-button>
    </div>

    <div
      v-if="error"
      class="test-error"
    >
      <pre>{{ error }}</pre>
    </div>

    <el-alert
      v-if="runtimeResult?.php"
      :title="runtimeResult.php.message || 'PHP 结构校验通过'"
      :type="runtimeResult.php.valid ? 'success' : 'error'"
      :description="runtimeResult.php.verified ? '已完成 PHP CLI 互逆验证' : '已完成结构校验'"
      show-icon
      :closable="false"
    />

    <template v-if="result">
      <div class="test-status-bar">
        <el-tag
          :type="result.inverseOk ? 'success' : 'danger'"
          size="small"
          effect="dark"
          round
        >
          {{ result.inverseOk ? '✓ 互逆验证通过' : '✗ 互逆验证失败' }}
        </el-tag>
      </div>
      <div class="test-result-grid">
        <div class="test-result-row">
          <span class="test-label">编码长度</span>
          <code>{{ result.encodedLength }} 字节</code>
        </div>
        <div class="test-result-row">
          <span class="test-label">十六进制摘要</span>
          <code class="test-code">{{ result.encodedHex }}</code>
        </div>
        <div class="test-result-row">
          <span class="test-label">可打印字符</span>
          <code class="test-code test-printable">{{ result.encodedPrintable }}</code>
        </div>
        <div class="test-result-row">
          <span class="test-label">Base64</span>
          <code class="test-code test-b64">{{ result.encodedBase64?.substring(0, 120) }}{{ (result.encodedBase64?.length ?? 0) > 120 ? '…' : '' }}</code>
        </div>
        <div class="test-result-row">
          <span class="test-label">decode 结果</span>
          <code class="test-code">{{ result.decoded }}</code>
        </div>
      </div>
    </template>

    <div
      v-else-if="!loading && !error"
      class="test-hint"
    >
      填写测试参数后点击「运行」，验证 encode → decode 互逆是否正确。
    </div>
  </div>
</template>

<script setup>
import { Icon } from '@iconify/vue'
import { icons } from '@/utils/icons.js'

defineProps({
  loading: Boolean,
  result: { type: Object, default: null },
  runtimeResult: { type: Object, default: null },
  error: { type: String, default: '' }
})

const emit = defineEmits(['run'])
const paramsText = defineModel('paramsText', { type: String, default: '' })
</script>

<style scoped>
.test-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 0 2px;
  overflow-y: auto;
}
.test-input-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
.test-input-label {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  flex-shrink: 0;
}
.test-input {
  flex: 1;
}
.test-status-bar {
  display: flex;
  align-items: center;
  gap: 4px;
}
.test-result-grid {
  display: flex;
  flex-direction: column;
  gap: 2px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  padding: 4px 7px;
  background: var(--el-fill-color-light);
}
.test-result-row {
  display: grid;
  grid-template-columns: 80px 1fr;
  align-items: baseline;
  gap: 3px;
}
.test-label {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  text-align: right;
  white-space: nowrap;
}
.test-code {
  font-family: var(--el-font-family-mono, monospace);
  font-size: 11px;
  color: var(--el-text-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 6%, transparent);
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 18%, transparent);
  border-radius: 3px;
  padding: 0 5px;
  word-break: break-all;
  line-height: 1.45;
}
.test-printable {
  letter-spacing: 0.03em;
  color: color-mix(in srgb, var(--el-color-success-dark-2) 90%, var(--el-text-color-primary));
}
.test-b64 {
  color: color-mix(in srgb, var(--el-color-info-dark-2) 90%, var(--el-text-color-primary));
  word-break: break-all;
}
.test-error {
  border-radius: 6px;
  background: color-mix(in srgb, var(--el-color-danger) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--el-color-danger) 24%, transparent);
  padding: 4px 8px;
}
.test-error pre {
  margin: 0;
  font-size: 11px;
  font-family: var(--el-font-family-mono, monospace);
  color: var(--el-color-danger);
  white-space: pre-wrap;
  word-break: break-all;
}
.test-hint {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  text-align: center;
  padding: 8px 0;
}
</style>
