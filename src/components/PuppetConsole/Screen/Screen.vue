<template>
  <div class="screen-page">
    <div class="screen-panel">
      <div class="screen-toolbar">
        <div class="toolbar-actions">
          <el-button
            :disabled="isCapturing"
            size="small"
            @click="captureScreenshot"
          >
            屏幕截图
          </el-button>
        </div>
      </div>

      <div class="screen-container">
        <div class="current-screenshot">
          <div
            v-if="screenshotDataUrl"
            class="image-container"
          >
            <img
              :src="screenshotDataUrl"
              alt="当前截图"
              class="screenshot-image"
              @error="handleScreenshotLoadError"
              @click="openImagePreview(screenshotDataUrl)"
            >
            <p v-if="capturedAt">
              截取时间：{{ formatTime(capturedAt) }}
            </p>
          </div>
          <div
            v-else-if="isCapturing"
            class="loading-placeholder"
          >
            <el-icon class="loading-icon">
              <Icon :icon="iconMap.loading" />
            </el-icon>
            <p>加载中...</p>
          </div>
          <div
            v-else
            class="empty-placeholder"
          >
            <el-icon class="empty-icon">
              <Icon :icon="iconMap.camera" />
            </el-icon>
            <p>点击"屏幕截图"按钮获取截图</p>
          </div>
        </div>
      </div>

      <div
        v-if="isPreviewVisible"
        class="modal-overlay"
        @click="closeImagePreview"
      >
        <div class="modal-content">
          <img
            :src="previewImageUrl"
            alt="放大图片"
            class="large-image"
          >
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

import { icons } from '@/utils/icons.js'
import { startScreenCaptureApi } from '@/services/api.js'
import { showError } from '@/utils/messageUtils.js'

const iconMap = icons

const props = defineProps({
  sessionId: {
    type: [String, Number],
    required: true
  }
})

const screenshotDataUrl = ref(null)
const capturedAt = ref(null)
const isCapturing = ref(false)
const isPreviewVisible = ref(false)
const previewImageUrl = ref('')

const formatTime = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleString()
}

const resetScreenshotState = () => {
  screenshotDataUrl.value = null
  capturedAt.value = null
}

const captureScreenshot = async () => {
  isCapturing.value = true
  try {
    const response = await startScreenCaptureApi({ sessionId: props.sessionId })
    const screenBytes = response.data?.screenBytes
    screenshotDataUrl.value = `data:image/jpeg;base64,${screenBytes}`
    capturedAt.value = response.data?.captureTime
  } catch {
    resetScreenshotState()
    showError('获取图片失败，请重试')
  } finally {
    isCapturing.value = false
  }
}

const handleScreenshotLoadError = () => {
  resetScreenshotState()
  showError('图片加载失败')
}

const openImagePreview = (imageUrl) => {
  previewImageUrl.value = imageUrl
  isPreviewVisible.value = true
}

const closeImagePreview = () => {
  isPreviewVisible.value = false
  previewImageUrl.value = ''
}
</script>

<style scoped>
.screen-page {
  height: 100%;
  min-height: 0;
  padding: 0;
  background: var(--app-frame-background);
  --screen-panel-surface: color-mix(
    in srgb,
    var(--app-surface-background) 94%,
    var(--el-bg-color-overlay)
  );
  --screen-toolbar-surface: color-mix(
    in srgb,
    var(--app-control-background-soft) 90%,
    var(--el-bg-color-overlay)
  );
  --screen-muted-surface: color-mix(
    in srgb,
    var(--app-control-background) 92%,
    var(--el-bg-color-overlay)
  );
  --screen-soft-border: color-mix(in srgb, var(--el-border-color) 38%, transparent);
  --screen-modal-surface: color-mix(
    in srgb,
    var(--app-card-background) 92%,
    var(--el-bg-color-overlay)
  );
}

:global(html:not(.dark) .screen-page),
:global(html[data-theme='light'] .screen-page) {
  --screen-panel-surface: var(--app-surface-background);
  --screen-toolbar-surface: #f2f2f2;
  --screen-muted-surface: #f2f2f2;
  --screen-soft-border: color-mix(in srgb, var(--el-border-color) 74%, transparent);
  --screen-modal-surface: var(--app-surface-background);
}

:global(html.dark .screen-page),
:global(html[data-theme='dark'] .screen-page) {
  --screen-panel-surface: color-mix(
    in srgb,
    var(--app-surface-background) 86%,
    var(--el-bg-color-overlay)
  );
  --screen-toolbar-surface: color-mix(
    in srgb,
    var(--app-control-background-soft) 78%,
    var(--el-bg-color-overlay)
  );
  --screen-muted-surface: color-mix(
    in srgb,
    var(--app-control-background) 84%,
    var(--el-bg-color-overlay)
  );
  --screen-soft-border: color-mix(in srgb, var(--el-border-color) 30%, transparent);
  --screen-modal-surface: color-mix(
    in srgb,
    var(--app-card-background) 88%,
    var(--el-bg-color-overlay)
  );
}

.screen-panel {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 24px;
  background: var(--screen-panel-surface);
  backdrop-filter: blur(18px);
}

.screen-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--el-spacing-base);
  padding: 12px 16px;
  background: var(--screen-toolbar-surface);
  border-bottom: 1px solid var(--screen-soft-border);
  backdrop-filter: blur(10px);
}

.screen-container {
  flex: 1;
  min-height: 0;
  padding: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.current-screenshot {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  position: relative;
  overflow: auto;
  border-radius: 20px;
  padding: 24px;
  background: var(--screen-muted-surface);
  border: 1px solid var(--screen-soft-border);
  box-shadow: var(--app-inset-highlight-soft), var(--app-shell-shadow-soft);
}

/* 图片容器 */
.image-container {
  width: 100%;
  text-align: center;
}

.screenshot-image {
  max-width: 100%;
  border: none;
  border-radius: 16px;
  cursor: pointer;
  box-shadow: var(--app-shell-shadow-strong);
}

.toolbar-actions {
  display: flex;
  gap: 12px;
}

.image-container p {
  margin-top: var(--el-spacing-base);
  font-size: var(--el-font-size-base);
  color: var(--el-text-color-regular);
}

.loading-placeholder,
.empty-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--el-spacing-base);
  color: var(--el-text-color-placeholder);
}

.loading-icon {
  font-size: 48px;
  animation: spin 1s linear infinite;
}

.empty-icon {
  font-size: 64px;
  color: color-mix(in srgb, var(--el-color-primary) 28%, var(--el-text-color-placeholder));
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background-color: var(--screen-modal-surface);
  padding: 20px;
  border-radius: 16px;
  max-width: 90%;
  max-height: 90%;
  overflow: auto;
}

.large-image {
  max-width: 100%;
  max-height: 80vh;
  border-radius: 12px;
}

.toolbar-actions :deep(.el-button) {
  border-radius: 14px;
  font-weight: 600;
}

.toolbar-actions :deep(.el-button:hover) {
  transform: translateY(-1px);
}

@media (max-width: 768px) {
  .screen-page {
    padding: 0;
    background: transparent;
  }

  .screen-panel {
    border-radius: 20px;
  }

  .screen-toolbar {
    padding: 12px;
  }

  .screen-container {
    padding: 12px;
  }

  .current-screenshot {
    padding: 18px;
  }
}
</style>
