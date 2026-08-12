<template>
  <div
    class="ai-dock"
    :class="{ 'ai-dock--hidden': !visible }"
    :style="{ width: visible ? dockWidth + 'px' : '0px' }"
  >
    <!-- Toggle tab — pure open/close control, never blocks -->
    <button
      class="dock-toggle-tab"
      :class="{ active: visible }"
      type="button"
      :title="visible ? '收起 AI 副驾' : '展开 AI 副驾'"
      :aria-label="visible ? '收起 AI 副驾' : '展开 AI 副驾'"
      :aria-expanded="visible"
      @click="emit('toggle')"
    >
      <span class="toggle-arrow">{{ visible ? '›' : '‹' }}</span>
      <span class="toggle-label">AI 副驾</span>
    </button>

    <!-- Inner container — handles overflow clipping during width animation -->
    <div class="dock-inner">
      <!-- Resize handle on left edge -->
      <div
        v-if="visible"
        class="dock-resize-handle"
        role="separator"
        aria-label="调整 AI 副驾宽度"
        aria-orientation="vertical"
        @mousedown="startResize"
      />

      <!-- AI panel body：已配置 → 助手；未配置 → 引导面板 -->
      <div
        v-show="visible"
        class="dock-body"
      >
        <PuppetAiAssistant
          v-if="aiAvailable"
          :session-id="sessionId"
          :initial-prompt="initialPrompt"
        />
        <AiNotConfiguredEmpty
          v-else
          :reason="aiUnavailableReason"
          :loading="aiLoading"
          @refresh="refreshAi"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineAsyncComponent, onBeforeUnmount, ref } from 'vue'
import AiNotConfiguredEmpty from '@/components/common/AiNotConfiguredEmpty.vue'
import { useAiAvailability } from '@/composables/useAiAvailability.js'
import { safeLocalStorage } from '@/utils/browserStorage.js'

const PuppetAiAssistant = defineAsyncComponent(
  () => import('@/components/PuppetConsole/Ai/PuppetAiAssistant.vue')
)

defineProps({
  sessionId: { type: String, required: true },
  initialPrompt: { type: String, default: '' },
  visible: { type: Boolean, default: false }
})

const emit = defineEmits(['toggle'])

// ── AI 可用性检测 ─────────────────────────────────────────────────────────
// dock 展开后内嵌引导面板（AiNotConfiguredEmpty），toggle 按钮不再拦截
const {
  available: aiAvailable,
  unavailableReason: aiUnavailableReason,
  loading: aiLoading,
  refresh: refreshAi
} = useAiAvailability()

// ── Width persistence ─────────────────────────────────────────────────────
const STORAGE_KEY_WIDTH = 'puppet-ai-dock-width'
const MIN_WIDTH = 380
const MAX_WIDTH = 840
const DEFAULT_WIDTH = 500

const dockWidth = ref(
  Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, parseInt(safeLocalStorage.getItem(STORAGE_KEY_WIDTH, String(DEFAULT_WIDTH)), 10) || DEFAULT_WIDTH))
)

// ── Resize logic ──────────────────────────────────────────────────────────
let resizing = false
let startX = 0
let startWidth = 0

function startResize(e) {
  resizing = true
  startX = e.clientX
  startWidth = dockWidth.value
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function onMouseMove(e) {
  if (!resizing) return
  const delta = startX - e.clientX   // dragging left = wider
  dockWidth.value = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta))
}

function stopResize() {
  resizing = false
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  safeLocalStorage.setItem(STORAGE_KEY_WIDTH, dockWidth.value)
}

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', stopResize)
})
</script>

<style scoped>
.ai-dock {
  --ai-dock-background: color-mix(
    in srgb,
    var(--app-surface-background) 88%,
    var(--el-fill-color-light)
  );

  flex-shrink: 0;
  display: flex;
  flex-direction: row;
  height: 100%;
  position: relative;
  border-left: 0;
  background: var(--ai-dock-background);
  transition: width 0.22s cubic-bezier(0.4, 0, 0.2, 1);
  min-width: 0;
  /* overflow: visible so the toggle tab can stick out to the left */
  overflow: visible;
}

.ai-dock--hidden {
  border-left: none;
}

/* ── Toggle tab — sticks out to the left edge of the dock ───────────────── */

.dock-toggle-tab {
  position: absolute;
  right: 100%;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  width: 26px;
  padding: 12px 0;
  border-radius: 9px 0 0 9px;
  border: 0;
  background: color-mix(in srgb, var(--el-color-primary) 6%, var(--app-surface-background, #fff));
  color: var(--el-color-primary);
  cursor: pointer;
  font-weight: 600;
  transition: background 0.15s, color 0.15s;
  z-index: 20;
  line-height: 1;
  box-shadow: -4px 8px 18px color-mix(in srgb, var(--el-text-color-primary) 8%, transparent);
}

.dock-toggle-tab:hover {
  background: color-mix(in srgb, var(--el-color-primary) 12%, var(--app-surface-background, #fff));
}

.dock-toggle-tab.active {
  background: var(--el-color-primary);
  color: #fff;
  box-shadow: none;
}

.dock-toggle-tab:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--el-color-primary) 36%, transparent);
  outline-offset: 2px;
}

.toggle-arrow {
  font-size: 15px;
  line-height: 1;
  font-style: normal;
}

.toggle-label {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  font-size: 10px;
  letter-spacing: 0.08em;
  white-space: nowrap;
}

/* ── Inner container — clips the panel during width animation ─────────── */

.dock-inner {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  display: flex;
  flex-direction: row;
  height: 100%;
  position: relative;
  background: var(--ai-dock-background);
}

.dock-resize-handle {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  cursor: col-resize;
  z-index: 10;
  transition: background 0.15s;
}

.dock-resize-handle::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: 1px;
  background: color-mix(in srgb, var(--el-border-color) 52%, transparent);
  content: '';
  transition: background 0.15s;
}

.dock-resize-handle:hover {
  background: transparent;
}

.dock-resize-handle:hover::before {
  background: color-mix(in srgb, var(--el-color-primary) 48%, transparent);
}

.dock-body {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--ai-dock-background);
}

.dock-body :deep(.puppet-ai-assistant),
.dock-body > * {
  height: 100%;
  flex: 1;
  min-height: 0;
}
</style>
