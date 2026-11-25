<template>
  <el-dialog
    v-model="visible"
    :title="path ? `成果预览 · ${path}` : '成果预览'"
    width="min(920px, calc(100vw - 32px))"
    destroy-on-close
    class="preview-dialog"
  >
    <div
      v-if="loading"
      class="preview-feedback"
      role="status"
    >
      正在读取成果…
    </div>
    <div
      v-else-if="error"
      class="preview-feedback"
    >
      <el-alert
        :title="error"
        type="error"
        :closable="false"
        show-icon
      />
      <el-button
        type="primary"
        plain
        @click="emit('retry')"
      >
        重新预览
      </el-button>
    </div>
    <div
      v-else-if="data?.previewable === false"
      class="preview-feedback"
    >
      <strong>此成果暂无文本预览</strong>
      <span>可下载原文件后，使用对应应用打开。</span>
      <el-button
        type="primary"
        @click="emit('download')"
      >
        下载原文件
      </el-button>
    </div>
    <template v-else-if="data">
      <div class="preview-meta">
        <el-tag
          size="small"
          effect="plain"
        >
          语言：{{ previewLanguage }}
        </el-tag>
        <el-tag
          size="small"
          effect="plain"
        >
          总大小：{{ formatFileSize(data.size || 0) }}
        </el-tag>
        <el-tag
          size="small"
          effect="plain"
        >
          预览字节：{{ data.previewSize || 0 }}
        </el-tag>
        <el-tag
          size="small"
          :type="data.truncated ? 'warning' : 'success'"
          effect="plain"
        >
          {{ data.truncated ? '内容已截断' : '完整内容' }}
        </el-tag>
      </div>
      <el-segmented
        v-if="previewLanguage === 'markdown'"
        v-model="previewMode"
        :options="previewModes"
        size="small"
        aria-label="预览方式"
        class="preview-mode"
      />
      <!-- Only sanitized, passive document HTML is inserted here. -->
      <!-- eslint-disable vue/no-v-html -->
      <article
        v-if="isReading"
        class="markdown-preview"
        aria-label="Markdown 阅读预览"
        v-html="renderedMarkdown"
      />
      <!-- eslint-enable vue/no-v-html -->
      <SourcePreview
        v-else-if="visible"
        :key="path"
        :content="data.content"
        :language="previewLanguage"
      />
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, defineAsyncComponent, h, ref, watch } from 'vue'
import { useDialogVisible } from '@/composables/useDialogVisible.js'
import { formatFileSize } from '@/utils/format.js'
import { detectUserSpaceLanguage } from './userSpaceModel.js'
import { renderArtifactMarkdown } from './artifactMarkdown.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  path: { type: String, default: '' },
  data: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue', 'retry', 'download'])

const SourcePreview = defineAsyncComponent({
  loader: () => import('./UserSpaceSourcePreview.vue'),
  delay: 0,
  loadingComponent: () => h('div', { class: 'preview-feedback', role: 'status' }, '正在加载源码查看器…'),
  errorComponent: () => h('div', { class: 'preview-feedback', role: 'alert' }, '源码查看器加载失败。可重新打开预览，或下载文件查看。')
})
const visible = useDialogVisible(props, emit)
const previewLanguage = computed(() => detectUserSpaceLanguage(props.path))
const previewMode = ref('rendered')
const previewModes = [{ label: '阅读预览', value: 'rendered' }, { label: '查看源码', value: 'source' }]
const isReading = computed(() => previewLanguage.value === 'markdown' && previewMode.value === 'rendered')
const renderedMarkdown = computed(() => isReading.value && typeof props.data?.content === 'string'
  ? renderArtifactMarkdown(props.data.content) : '')

watch(() => props.path, () => { previewMode.value = 'rendered' })
</script>

<style scoped>
.preview-feedback {
  min-height: 100px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 12px;
  color: var(--el-text-color-secondary);
}

.preview-dialog :deep(.el-dialog__title) {
  overflow-wrap: anywhere;
}

.preview-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.preview-mode {
  margin-bottom: 12px;
}

.markdown-preview {
  height: 58vh;
  min-height: 360px;
  overflow: auto;
  padding: 20px 24px;
  border: 1px solid var(--app-divider-color);
  border-radius: var(--el-border-radius-base);
  background: var(--app-container-background);
  color: var(--el-text-color-primary);
  font-size: 14px;
  line-height: 1.8;
  overflow-wrap: anywhere;
}

.markdown-preview :deep(> :first-child) {
  margin-top: 0;
}
.markdown-preview :deep(h1),
.markdown-preview :deep(h2),
.markdown-preview :deep(h3),
.markdown-preview :deep(h4),
.markdown-preview :deep(h5),
.markdown-preview :deep(h6) {
  margin: 1.4em 0 0.6em;
  line-height: 1.5;
  font-weight: 650;
}
.markdown-preview :deep(h1) {
  font-size: 24px;
}
.markdown-preview :deep(h2) {
  font-size: 20px;
}
.markdown-preview :deep(h3) {
  font-size: 17px;
}
.markdown-preview :deep(h4),
.markdown-preview :deep(h5),
.markdown-preview :deep(h6) {
  font-size: 15px;
}
.markdown-preview :deep(p) {
  margin: 0.7em 0;
}
.markdown-preview :deep(ul),
.markdown-preview :deep(ol) {
  padding-left: 1.7em;
}
.markdown-preview :deep(li) {
  margin: 0.3em 0;
}
.markdown-preview :deep(blockquote) {
  margin: 1em 0;
  padding: 4px 14px;
  border-left: 3px solid var(--el-color-primary-light-5);
  color: var(--el-text-color-secondary);
  background: var(--app-control-background-soft);
}
.markdown-preview :deep(hr) {
  margin: 20px 0;
  border: 0;
  border-top: 1px solid var(--app-divider-color);
}
.markdown-preview :deep(code) {
  padding: 2px 5px;
  border-radius: 4px;
  background: var(--app-control-background-soft);
  font-family: var(--el-font-family-mono);
  font-size: 0.9em;
}
.markdown-preview :deep(pre) {
  padding: 14px 16px;
  border: 1px solid var(--app-divider-color);
  border-radius: 6px;
  background: var(--app-control-background-soft);
  overflow: auto;
  line-height: 1.6;
}
.markdown-preview :deep(pre code) {
  padding: 0;
  background: transparent;
  white-space: pre;
}
.markdown-preview :deep(table) {
  display: block;
  max-width: 100%;
  overflow-x: auto;
  margin: 16px 0;
  border-collapse: collapse;
}
.markdown-preview :deep(th),
.markdown-preview :deep(td) {
  padding: 8px 12px;
  border: 1px solid var(--app-divider-color);
  text-align: left;
}
.markdown-preview :deep(th) {
  background: var(--app-control-background-soft);
  font-weight: 600;
}
.markdown-preview :deep(a) {
  color: var(--el-color-primary);
  text-decoration: underline;
}
</style>
