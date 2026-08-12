<template>
  <section class="preview-panel">
    <div class="preview-heading">
      <div>
        <span class="panel-kicker">
          <Icon :icon="iconMap.codeFile" />
          Build Artifact · 构建产物
        </span>
        <div class="preview-title-row">
          <strong>{{ outputResult ? '产物已生成' : '等待构建' }}</strong>
          <span :class="['artifact-state', { stale: isResultStale, ready: outputResult && !isResultStale }]">
            {{ isResultStale ? '配置已变更' : (outputResult ? 'Ready' : 'Draft') }}
          </span>
        </div>
      </div>
      <div class="result-actions">
        <el-dropdown
          v-if="classArtifacts.length"
          trigger="click"
          :disabled="isResultStale"
          @command="emit('download-class-artifact', $event)"
        >
          <el-button :disabled="isResultStale">
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
          :disabled="!outputResult || isResultStale"
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
              type="primary"
              class="gen-button"
              @click="emit('generate')"
            >
              <el-icon><Icon :icon="iconMap.codeGenerator" /></el-icon>
              生成脚本
            </el-button>
          </span>
        </el-tooltip>
      </div>
    </div>

    <section
      class="config-context"
      aria-label="生成配置"
    >
      <button
        type="button"
        class="summary-copy-btn"
        title="复制配置"
        aria-label="复制配置"
        @click="emit('copy-summary')"
      >
        <Icon :icon="iconMap.copy" />
      </button>
      <div class="manifest-heading">
        <strong>Build Manifest</strong>
        <small>当前配置与生成元数据</small>
      </div>
      <div class="manifest-grid">
        <div
          v-for="item in mergedContextItems"
          :key="item.label"
          class="manifest-item"
        >
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
      </div>
    </section>

    <div
      v-if="isResultStale"
      class="stale-banner"
    >
      <Icon
        :icon="iconMap.warning"
        class="stale-icon"
      />
      配置已变更，当前结果可能已过期
      <button
        type="button"
        class="stale-regen-btn"
        @click="emit('generate')"
      >
        重新生成
      </button>
    </div>

    <div class="editor-shell">
      <button
        type="button"
        class="code-copy-btn"
        title="复制代码"
        aria-label="复制代码"
        :disabled="!outputResult"
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
        <div class="empty-icon">
          <Icon :icon="iconMap.codeGenerator" />
        </div>
        <h3>等待生成脚本</h3>
        <p>完成左侧必填配置后，生成结果会显示在这里。</p>
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

const mergedContextItems = computed(() => {
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

.panel-kicker {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  color: var(--el-text-color-placeholder);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.06em;
}

.preview-title-row { display: flex; align-items: center; gap: 8px; }
.preview-title-row strong { color: var(--sg-ink); font-size: 14px; }
.artifact-state { padding: 2px 6px; border-radius: 999px; background: var(--sg-panel-soft); color: var(--sg-muted); font-size: 8px; font-weight: 700; }
.artifact-state.ready { background: var(--sg-green-soft); color: var(--sg-green); }
.artifact-state.stale { background: color-mix(in srgb, var(--el-color-warning) 12%, var(--sg-panel-strong)); color: var(--el-color-warning); }

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
  background: color-mix(in srgb, var(--sg-panel-soft) 86%, transparent);
  text-align: center;
  pointer-events: none;
}

.empty-icon {
  width: 48px;
  height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: var(--sg-blue);
  background: var(--sg-blue-soft);
  font-size: 24px;
}

.result-empty h3 {
  margin: 0;
  color: var(--sg-ink);
  font-size: 16px;
  font-weight: 700;
}

.result-empty p {
  margin: 0;
  max-width: 280px;
  color: var(--sg-muted);
  font-size: 13px;
  line-height: 1.6;
}

/* ── 配置摘要 ── */
.config-context {
  position: relative;
  flex: 0 0 auto;
  margin: 10px 14px 8px;
  padding: 9px 38px 9px 10px;
  border: 1px solid var(--sg-border);
  border-radius: 10px;
  background: var(--sg-panel-soft);
}

.summary-copy-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid var(--sg-border);
  border-radius: var(--radius-control);
  background: var(--sg-panel-strong);
  color: var(--sg-blue);
  cursor: pointer;
  font-size: 12px;
  font-weight: 900;
}

.summary-copy-btn:hover {
  border-color: color-mix(in srgb, var(--sg-blue) 36%, transparent);
  background: var(--sg-blue-soft);
}

.manifest-heading { display: flex; align-items: baseline; gap: 7px; margin-bottom: 7px; }
.manifest-heading strong { color: var(--sg-ink); font-size: 10px; }
.manifest-heading small { color: var(--sg-muted); font-size: 8px; }
.manifest-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; }
.manifest-item { min-width: 0; padding: 5px 7px; border-radius: 6px; background: var(--sg-panel-strong); }
.manifest-item span, .manifest-item strong { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.manifest-item span { margin-bottom: 2px; color: var(--sg-muted); font-size: 8px; }
.manifest-item strong { color: var(--sg-ink); font-size: 9px; font-weight: 600; }

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

.stale-regen-btn {
  margin-left: auto;
  padding: 2px 10px;
  border-radius: 5px;
  border: 1px solid color-mix(in srgb, var(--el-color-warning) 50%, transparent);
  background: color-mix(in srgb, var(--el-color-warning) 14%, transparent);
  color: color-mix(in srgb, var(--el-color-warning) 90%, var(--el-text-color-primary));
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.stale-regen-btn:hover {
  background: color-mix(in srgb, var(--el-color-warning) 22%, transparent);
  border-color: color-mix(in srgb, var(--el-color-warning) 70%, transparent);
}

/* ── Monaco 编辑器壳 ── */
.editor-shell {
  position: relative;
  flex: 1;
  min-height: 360px;
  margin: 0 14px 12px;
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
  .preview-panel { min-height: 760px; }
}

@media (max-width: 760px) {
  .preview-heading {
    flex-direction: column;
    align-items: flex-start;
    padding-left: 10px;
    padding-right: 10px;
  }

  .result-actions { justify-content: flex-start; }

  .manifest-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }

  .editor-shell,
  .config-context {
    margin-left: 10px;
    margin-right: 10px;
  }
}
</style>
