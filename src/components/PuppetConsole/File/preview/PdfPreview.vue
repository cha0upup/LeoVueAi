<template>
  <div class="pdf-preview-wrap">
    <iframe
      v-if="pdfSrc && !error"
      ref="iframeRef"
      :src="iframeSrc"
      class="pdf-iframe"
      title="PDF预览"
      @load="onLoad"
      @error="onError"
    />

    <div
      v-if="loading"
      class="pdf-state pdf-state--overlay"
    >
      <el-icon class="loading-spin">
        <Icon icon="mdi:loading" />
      </el-icon>
      <span>正在加载 PDF…</span>
    </div>

    <div
      v-else-if="error"
      class="pdf-state pdf-state--error"
    >
      <Icon
        icon="mdi:file-alert-outline"
        class="pdf-state-icon"
      />
      <span>{{ error }}</span>
      <el-button
        size="small"
        @click="openExternal"
      >
        在新标签中打开
      </el-button>
    </div>

    <div
      v-else-if="!pdfSrc"
      class="pdf-state"
    >
      <Icon
        icon="mdi:file-pdf-box"
        class="pdf-state-icon"
      />
      <span>无 PDF 内容</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onBeforeUnmount, watch } from 'vue'
import { Icon } from '@iconify/vue'

const props = defineProps({
  /** data:application/pdf;base64,... or object URL */
  pdfSrc: { type: String, default: '' },
  fileName: { type: String, default: 'document.pdf' }
})

const loading   = ref(false)
const error     = ref('')
const iframeRef = ref(null)
const objectUrl = ref('')

// Use a stable object URL when given a base64 data URI (avoids iframe length limits in some browsers)
const iframeSrc = computed(() => {
  if (!props.pdfSrc) return ''
  if (props.pdfSrc.startsWith('blob:')) return props.pdfSrc
  if (props.pdfSrc.startsWith('data:application/pdf')) {
    // Use cached object URL
    return objectUrl.value || props.pdfSrc
  }
  return props.pdfSrc
})

function revokeObjectUrl() {
  if (objectUrl.value) {
    URL.revokeObjectURL(objectUrl.value)
    objectUrl.value = ''
  }
}

watch(() => props.pdfSrc, (val) => {
  revokeObjectUrl()
  error.value = ''
  if (val && val.startsWith('data:application/pdf')) {
    loading.value = true
    try {
      const byteStr = atob(val.split(',')[1])
      const bytes = new Uint8Array(byteStr.length)
      for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i)
      const blob = new Blob([bytes], { type: 'application/pdf' })
      objectUrl.value = URL.createObjectURL(blob)
    } catch {
      error.value = '无法解析 PDF 数据'
      loading.value = false
    }
  } else if (val) {
    loading.value = true
  }
}, { immediate: true })

function onLoad() {
  loading.value = false
}

function onError() {
  loading.value = false
  error.value = '浏览器无法内嵌显示此 PDF，请下载后查看。'
}

function openExternal() {
  const src = objectUrl.value || props.pdfSrc
  if (src) window.open(src, '_blank', 'noopener,noreferrer')
}

onBeforeUnmount(revokeObjectUrl)
</script>

<style scoped>
.pdf-preview-wrap {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color-page);
  overflow: hidden;
  position: relative;
}

.pdf-iframe {
  flex: 1;
  width: 100%;
  border: none;
  background: transparent;
}

.pdf-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  min-height: 200px;
}

.pdf-state--overlay {
  position: absolute;
  inset: 0;
  background: var(--el-bg-color-page);
  z-index: 1;
}

.pdf-state--error {
  color: var(--el-color-danger);
}

.pdf-state-icon {
  font-size: 42px;
  opacity: 0.4;
}

.loading-spin {
  font-size: 28px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
</style>
