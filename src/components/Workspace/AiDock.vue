<template>
  <div
    ref="dockRef"
    class="ai-dock"
    :class="{ 'ai-dock--hidden': !visible, 'is-resizing': resizing }"
    :style="{ width: visible ? renderedWidth + 'px' : '0px' }"
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
        tabindex="0"
        aria-label="调整 AI 副驾宽度"
        aria-orientation="vertical"
        :aria-valuemin="minimumWidth"
        :aria-valuemax="maximumWidth"
        :aria-valuenow="renderedWidth"
        @pointerdown="startResize"
        @pointermove="onPointerMove"
        @pointerup="stopResize"
        @pointercancel="cancelResize"
        @lostpointercapture="stopResize"
        @keydown.left.prevent="setWidth(renderedWidth + 20)"
        @keydown.right.prevent="setWidth(renderedWidth - 20)"
        @keydown.home.prevent="setWidth(minimumWidth)"
        @keydown.end.prevent="setWidth(maximumWidth)"
      />

      <!-- AI panel body：已配置 → 助手；未配置 → 引导面板 -->
      <div
        v-show="visible"
        class="dock-body"
      >
        <NodeAiAssistant
          v-if="aiAvailable"
          :session-id="sessionId"
          :initial-prompt="initialPrompt"
          :active-module="activeModule"
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
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AiNotConfiguredEmpty from '@/components/common/AiNotConfiguredEmpty.vue'
import { useAiAvailability } from '@/composables/ai/useAiAvailability.js'
import { safeLocalStorage } from '@/utils/browserStorage.js'

const NodeAiAssistant = defineAsyncComponent(
  () => import('@/components/AgentConsole/Ai/NodeAiAssistant.vue')
)

const props = defineProps({
  sessionId: { type: String, required: true },
  initialPrompt: { type: String, default: '' },
  activeModule: { type: Object, default: null },
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
const STORAGE_KEY_WIDTH = 'node-ai-dock-width'
const MIN_WIDTH = 380
const MAX_WIDTH = 840
const DEFAULT_WIDTH = 500

const dockWidth = ref(
  Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, parseInt(safeLocalStorage.getItem(STORAGE_KEY_WIDTH, String(DEFAULT_WIDTH)), 10) || DEFAULT_WIDTH))
)
const dockRef = ref(null)
const workspaceWidth = ref(typeof window === 'undefined' ? 1280 : window.innerWidth)
const maximumWidth = computed(() => Math.max(0, Math.min(MAX_WIDTH,
  workspaceWidth.value <= 900 ? workspaceWidth.value - 26 : workspaceWidth.value - 480
)))
const minimumWidth = computed(() => Math.min(MIN_WIDTH, maximumWidth.value))
const clampWidth = width => Math.min(maximumWidth.value, Math.max(minimumWidth.value, width))
const renderedWidth = computed(() => clampWidth(dockWidth.value))
const setWidth = width => {
  dockWidth.value = clampWidth(width)
  safeLocalStorage.setItem(STORAGE_KEY_WIDTH, dockWidth.value)
}

let workspaceObserver
onMounted(() => {
  const workspace = dockRef.value?.parentElement
  if (!workspace) return
  workspaceWidth.value = workspace.clientWidth
  workspaceObserver = new ResizeObserver(([entry]) => {
    if (entry) workspaceWidth.value = entry.contentRect.width
  })
  workspaceObserver.observe(workspace)
})

// ── Resize logic ──────────────────────────────────────────────────────────
const resizing = ref(false)
let startX = 0
let startWidth = 0
let resizeHandle = null
let pointerId = null

function startResize(e) {
  if (e.button !== 0) return
  e.preventDefault()
  resizing.value = true
  startX = e.clientX
  startWidth = renderedWidth.value
  resizeHandle = e.currentTarget
  pointerId = e.pointerId
  resizeHandle.setPointerCapture(pointerId)
}

function onPointerMove(e) {
  if (!resizing.value || e.pointerId !== pointerId) return
  const delta = startX - e.clientX   // dragging left = wider
  dockWidth.value = clampWidth(startWidth + delta)
}

function finishResize(persist) {
  if (!resizing.value) return
  resizing.value = false
  const handle = resizeHandle
  const id = pointerId
  resizeHandle = null
  pointerId = null
  if (handle?.hasPointerCapture(id)) handle.releasePointerCapture(id)
  if (persist) safeLocalStorage.setItem(STORAGE_KEY_WIDTH, dockWidth.value)
}
function stopResize() { finishResize(true) }
function cancelResize() { finishResize(false) }

watch(() => props.visible, visible => { if (!visible) stopResize() })

onBeforeUnmount(() => {
  cancelResize()
  workspaceObserver?.disconnect()
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

.ai-dock.is-resizing { transition: none; user-select: none; }

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
  width: 6px;
  cursor: col-resize;
  touch-action: none;
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

.dock-resize-handle:hover,
.dock-resize-handle:focus-visible {
  background: var(--app-selected-background);
  outline: var(--focus-outline);
  outline-offset: -2px;
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

.dock-body :deep(.node-ai-assistant),
.dock-body > * {
  height: 100%;
  flex: 1;
  min-height: 0;
}

@container console-workspace (max-width: 900px) {
  .ai-dock {
    position: absolute;
    inset: 0 0 0 auto;
    z-index: 30;
    max-width: calc(100% - 26px);
    box-shadow: var(--shadow-overlay);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ai-dock { transition: none; }
}
</style>
