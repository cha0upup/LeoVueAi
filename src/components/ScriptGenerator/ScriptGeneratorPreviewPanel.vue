<template>
  <section class="preview-panel">
    <div class="preview-heading">
      <div class="preview-title-row">
        <h2>生成结果</h2>
        <span
          v-if="outputResult"
          class="artifact-state"
          :class="{ stale: isResultStale }"
        >
          {{ isResultStale ? '待重新生成' : '已生成' }}
        </span>
      </div>
      <div class="result-actions">
        <el-dropdown
          v-if="classArtifacts.length"
          trigger="click"
          :disabled="isResultStale || isGenerating"
          @command="emit('download-class-artifact', $event)"
        >
          <el-button :disabled="isResultStale || isGenerating">
            <el-icon><Icon :icon="iconMap.download" /></el-icon>
            Class 产物 {{ classArtifacts.length }}
            <el-icon class="el-icon--right">
              <Icon :icon="iconMap.arrowDown" />
            </el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item
                v-for="artifact in classArtifacts"
                :key="`${artifact.role}:${artifact.className}`"
                :command="artifact"
              >
                <span class="class-artifact-option">
                  <strong>{{ classArtifactLabel(artifact) }}</strong>
                  <small>{{ artifact.fileName }}</small>
                </span>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button
          v-if="outputResult"
          :disabled="isResultStale || isGenerating"
          :loading="isSavingArtifact"
          @click="emit('save-artifact')"
        >
          <el-icon><Icon :icon="iconMap.save" /></el-icon>
          保存成果
        </el-button>
        <el-tooltip
          content="请先完成所有必填项配置"
          :disabled="isFormValid"
          placement="bottom"
        >
          <span class="gen-btn-wrap">
            <el-button
              :disabled="!isFormValid"
              :loading="isGenerating"
              type="primary"
              class="gen-button"
              @click="emit('generate')"
            >
              <el-icon v-if="!isGenerating"><Icon :icon="iconMap.codeGenerator" /></el-icon>
              {{ isGenerating ? '正在生成' : isResultStale ? '重新生成' : '生成脚本' }}
            </el-button>
          </span>
        </el-tooltip>
      </div>
    </div>

    <details class="config-context">
      <summary>
        <span class="summary-label">当前配置</span>
        <strong :title="buildOverview">{{ buildOverview }}</strong>
        <span class="summary-toggle">详情 <Icon :icon="iconMap.arrowDown" /></span>
      </summary>
      <div class="context-details">
        <div class="manifest-heading">
          <strong>{{ outputResult && !isResultStale ? '生成详情' : '配置详情' }}</strong>
          <button
            type="button"
            class="summary-copy-btn"
            @click="emit('copy-summary')"
          >
            <Icon :icon="iconMap.copy" />复制当前配置
          </button>
        </div>
        <dl class="manifest-grid">
          <template
            v-for="item in contextItems"
            :key="item.label"
          >
            <dt>{{ item.label }}</dt>
            <dd>{{ item.value }}</dd>
          </template>
        </dl>
      </div>
    </details>

    <div
      v-if="isResultStale"
      class="stale-banner"
      role="status"
    >
      <Icon
        :icon="iconMap.warning"
        class="stale-icon"
      />
      配置已变更，请重新生成。下方保留上次结果供查看。
    </div>

    <div class="editor-shell">
      <button
        v-if="outputResult"
        type="button"
        class="code-copy-btn"
        title="复制代码"
        aria-label="复制代码"
        :disabled="isResultStale || isGenerating"
        @click="emit('copy')"
      >
        <CopyDocument />
      </button>
      <div
        ref="monacoContainer"
        class="file-content"
      />
      <div
        v-if="!outputResult"
        class="result-empty"
      >
        <Icon
          class="empty-icon"
          :icon="isGenerating ? iconMap.loading : iconMap.codeGenerator"
          :class="{ 'u-spin': isGenerating }"
        />
        <p>{{ isGenerating ? '正在生成，请稍候…' : '完成配置后，点击「生成脚本」。' }}</p>
      </div>
    </div>

    <div
      v-if="resultStats"
      class="result-stats"
    >
      <span>{{ resultStats.lines }} 行</span>
      <span class="stats-sep">·</span>
      <span>{{ resultStats.chars.toLocaleString() }} 字符</span>
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { CopyDocument } from '@element-plus/icons-vue'
import { icons } from '@/utils/icons.js'
import { formatClassArtifactLabel } from './scriptGeneratorArtifacts.js'

const iconMap = icons
const monacoContainer = ref(null)

const props = defineProps({
  outputResult:      { type: String,  default: '' },
  buildOverview:     { type: String,  default: '' },
  isGenerating:      { type: Boolean, default: false },
  isFormValid:       { type: Boolean, default: false },
  isResultStale:     { type: Boolean, default: false },
  isSavingArtifact:  { type: Boolean, default: false },
  classArtifacts:    { type: Array,   default: () => [] },
  resultMeta:        { type: Array,   default: () => [] },
  configSummary:     { type: Array,   default: () => [] }
})

const emit = defineEmits([
  'copy',
  'generate',
  'save-artifact',
  'copy-summary',
  'download-class-artifact',
  'container-ready'
])

const classArtifactLabel = (artifact) => formatClassArtifactLabel(artifact)

// ── 结果統計 ──────────────────────────────────────────────────────────────────

const resultStats = computed(() => {
  const text = props.outputResult
  if (!text) return null
  return { lines: text.split('\n').length, chars: text.length }
})

// ── 配置摘要 ──────────────────────────────────────────────────────────────────

const contextItems = computed(() => {
  if (!props.outputResult || props.isResultStale) return props.configSummary
  const seen = new Set()
  return [...props.resultMeta, ...props.configSummary]
    .filter(item => {
      const label = String(item?.label || '')
      if (!label || seen.has(label)) return false
      seen.add(label)
      return true
    })
})

onMounted(() => {
  emit('container-ready', monacoContainer.value)
})

onBeforeUnmount(() => {
  emit('container-ready', null)
})
</script>

<style scoped>
.preview-panel {
  min-height: 0;
  border: 1px solid var(--app-surface-border-strong);
  border-radius: var(--app-panel-radius);
  background: color-mix(in srgb, var(--app-card-background) 94%, var(--app-surface-background));
  box-shadow: none;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.preview-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex: 0 0 auto;
  padding: var(--space-3) var(--space-3) var(--space-2);
  border-bottom: 1px solid var(--app-divider-color);
  background: var(--app-container-background);
}

.preview-title-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; min-height: 30px; }
.preview-title-row h2 { margin: 0; color: var(--sg-ink); font-size: 14px; }
.artifact-state { color: var(--sg-green); font-size: 11px; }
.artifact-state.stale { color: var(--el-color-warning); }

.result-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
}

.result-actions :deep(.el-button) {
  height: 30px;
  margin: 0;
  padding: 0 14px;
  border-radius: var(--radius-control);
}

.result-actions :deep(.gen-button) { box-shadow: none; }

.class-artifact-option {
  display: flex;
  min-width: 180px;
  flex-direction: column;
  gap: 1px;
}

.class-artifact-option strong { font-size: 12px; }
.class-artifact-option small { color: var(--el-text-color-secondary); font-size: 10px; }

.gen-btn-wrap { display: inline-flex; }

.result-empty {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 20px;
  background: var(--el-bg-color);
  text-align: center;
  pointer-events: none;
}

.empty-icon { color: var(--el-text-color-placeholder); font-size: 28px; }

.result-empty p {
  margin: 0;
  max-width: 280px;
  color: var(--sg-muted);
  font-size: 13px;
  line-height: 1.6;
}

/* ── 配置摘要 ── */
.config-context {
  flex: 0 1 auto;
  min-height: 42px;
  max-height: 280px;
  overflow: auto;
  margin: 0 14px;
  border-bottom: 1px solid var(--app-divider-color);
}

.config-context summary {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 0;
  list-style: none;
  cursor: pointer;
}

.config-context summary::-webkit-details-marker { display: none; }
.summary-label { flex-shrink: 0; color: var(--sg-muted); font-size: 11px; }
.config-context summary > strong { min-width: 0; overflow: hidden; color: var(--sg-ink); font-size: 12px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.summary-toggle { display: inline-flex; align-items: center; flex-shrink: 0; gap: 4px; margin-left: auto; color: var(--sg-blue); font-size: 11px; }
.config-context[open] .summary-toggle svg { transform: rotate(180deg); }
.context-details { padding: 0 0 12px; }
.manifest-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
.manifest-heading strong { color: var(--sg-muted); font-size: 11px; font-weight: 500; }
.summary-copy-btn { display: inline-flex; align-items: center; gap: 4px; padding: 3px 0; border: 0; background: transparent; color: var(--sg-blue); cursor: pointer; font-size: 11px; }
.summary-copy-btn:focus-visible, .config-context summary:focus-visible { outline: var(--focus-outline); outline-offset: 2px; }
.manifest-grid { display: grid; grid-template-columns: minmax(85px, 28%) minmax(0, 1fr); gap: 7px 12px; margin: 0; font-size: 12px; line-height: 1.5; }
.manifest-grid dt { color: var(--sg-muted); overflow-wrap: anywhere; }
.manifest-grid dd { margin: 0; color: var(--sg-ink); overflow-wrap: anywhere; }

/* ── 过期提示 ── */
.stale-banner {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 14px;
  flex: 0 0 auto;
  background: color-mix(in srgb, var(--el-color-warning) 10%, var(--app-card-background));
  border-top: 1px solid color-mix(in srgb, var(--el-color-warning) 30%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--el-color-warning) 30%, transparent);
  font-size: 12px;
  color: color-mix(in srgb, var(--el-color-warning) 80%, var(--el-text-color-primary));
}

.stale-icon {
  flex-shrink: 0;
  font-size: 14px;
  color: var(--el-color-warning);
}

/* ── Monaco 编辑器壳 ── */
.editor-shell {
  position: relative;
  flex: 1;
  min-height: 180px;
  margin: 10px 14px 12px;
  display: block;
  overflow: hidden;
  border-radius: var(--radius-container);
  border: 1px solid color-mix(in srgb, var(--el-border-color) 28%, transparent);
  background: var(--el-bg-color);
  box-shadow: none;
}

.code-copy-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 4;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 60%, transparent);
  border-radius: var(--radius-control);
  background: color-mix(in srgb, var(--app-card-background) 88%, transparent);
  color: var(--el-text-color-regular);
  cursor: pointer;
}

.code-copy-btn:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--sg-blue) 50%, transparent);
  background: var(--sg-blue-soft);
  color: var(--sg-blue);
}

.code-copy-btn:disabled { cursor: not-allowed; opacity: 0.42; }

.code-copy-btn svg { width: 15px; height: 15px; }

.file-content { min-height: 0; width: 100%; height: 100%; }

.result-stats {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 14px 8px;
  font-size: 11px;
  color: var(--sg-muted);
  opacity: 0.7;
}

.stats-sep { opacity: 0.5; }

@media (max-width: 1220px) {
  .preview-panel { min-height: 480px; }
}

@media (max-width: 760px) {
  .preview-heading {
    flex-direction: column;
    align-items: flex-start;
    padding-left: 10px;
    padding-right: 10px;
  }

  .result-actions { justify-content: flex-start; }

  .editor-shell,
  .config-context {
    margin-left: 10px;
    margin-right: 10px;
  }
}
</style>
