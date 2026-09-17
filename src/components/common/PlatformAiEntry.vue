<template>
  <button
    ref="entryRef"
    type="button"
    class="ai-entry-btn"
    :class="{ active: panelOpen }"
    :title="aiAvailable ? '平台 AI' : (aiUnavailableReason || '平台 AI（未配置）')"
    :aria-label="panelOpen ? '收起平台 AI' : '打开平台 AI'"
    :aria-expanded="panelOpen"
    aria-controls="platform-ai-panel"
    @mouseenter="warmPlatformAiAssistant"
    @focus="warmPlatformAiAssistant"
    @click="panelOpen ? closePanel() : panelOpen = true"
  >
    <Icon
      :icon="iconMap.chatAi"
      class="ai-entry-icon"
    />
    <span class="ai-entry-label">平台 AI</span>
  </button>

  <Teleport to="body">
    <Transition name="platform-ai-slide">
      <aside
        v-if="platformAiMounted"
        v-show="panelOpen"
        id="platform-ai-panel"
        ref="panelRef"
        class="platform-ai-panel"
        :class="{ 'is-resizing': resizing }"
        :style="{ width: panelWidth + 'px', zIndex: panelZIndex }"
        aria-label="平台 AI（全平台）"
        tabindex="-1"
        @keydown.esc.stop="closePanel"
      >
        <div
          class="panel-resize-handle"
          role="separator"
          tabindex="0"
          aria-label="调整平台 AI 宽度"
          aria-orientation="vertical"
          :aria-valuemin="MIN_WIDTH"
          :aria-valuemax="MAX_WIDTH"
          :aria-valuenow="panelWidth"
          @pointerdown="startResize"
          @pointermove="resizePanel"
          @pointerup="finishResize"
          @pointercancel="finishResize"
          @lostpointercapture="finishResize"
          @keydown.left.prevent="setPanelWidth(panelWidth + 20)"
          @keydown.right.prevent="setPanelWidth(panelWidth - 20)"
        />
        <PlatformAiAssistant
          v-if="aiAvailable"
          @close="closePanel"
        />
        <template v-else>
          <header class="empty-header">
            <strong>平台 AI · 全平台</strong>
            <button
              type="button"
              aria-label="关闭平台 AI"
              @click="closePanel"
            >
              <Icon :icon="iconMap.close" />
            </button>
          </header>
          <AiNotConfiguredEmpty
            class="platform-ai-empty"
            :reason="aiUnavailableReason"
            :loading="aiLoading"
            @refresh="refreshAiAvailability"
          />
        </template>
      </aside>
    </Transition>
  </Teleport>
</template>

<script setup>
import { Icon } from '@iconify/vue'
import { defineAsyncComponent, nextTick, onUnmounted, ref, watch } from 'vue'
import { useZIndex } from 'element-plus'
import { safeLocalStorage } from '@/utils/browserStorage.js'

import AiNotConfiguredEmpty from '@/components/common/AiNotConfiguredEmpty.vue'
import { useAiAvailability } from '@/composables/useAiAvailability.js'
import { icons } from '@/utils/icons.js'

const PlatformAiAssistant = defineAsyncComponent(
  () => import('@/components/PlatformAi/PlatformAiAssistant.vue')
)

const warmPlatformAiAssistant = () => {
  if (aiAvailable.value) import('@/components/PlatformAi/PlatformAiAssistant.vue')
}

const iconMap = icons
const panelOpen = ref(false)
const platformAiMounted = ref(false)

const entryRef = ref(null)
const panelRef = ref(null)
const { nextZIndex } = useZIndex()
const panelZIndex = ref(0)
const WIDTH_STORAGE_KEY = 'platform-ai-panel-width'
const MIN_WIDTH = 380
const MAX_WIDTH = 840
const panelWidth = ref(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH,
  Number(safeLocalStorage.getItem(WIDTH_STORAGE_KEY)) || 600
)))
const resizing = ref(false)
let resizeStartX = 0
let resizeStartWidth = 0

const setPanelWidth = width => {
  panelWidth.value = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width))
  safeLocalStorage.setItem(WIDTH_STORAGE_KEY, panelWidth.value)
}
const startResize = event => {
  if (event.button !== 0) return
  event.preventDefault()
  resizing.value = true
  resizeStartX = event.clientX
  resizeStartWidth = panelRef.value.getBoundingClientRect().width
  event.currentTarget.setPointerCapture(event.pointerId)
}
const resizePanel = event => {
  if (!resizing.value) return
  panelWidth.value = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH,
    resizeStartWidth + resizeStartX - event.clientX
  ))
}
const finishResize = () => {
  if (!resizing.value) return
  resizing.value = false
  safeLocalStorage.setItem(WIDTH_STORAGE_KEY, panelWidth.value)
}
const closePanel = () => {
  finishResize()
  panelOpen.value = false
  nextTick(() => entryRef.value?.focus())
}

watch(panelOpen, async open => {
  if (!open) return
  platformAiMounted.value = true
  panelZIndex.value = nextZIndex()
  await nextTick()
  panelRef.value?.focus()
})

const {
  available: aiAvailable,
  unavailableReason: aiUnavailableReason,
  loading: aiLoading,
  refresh: refreshAiAvailability
} = useAiAvailability()

const onVisibilityChange = () => {
  if (document.visibilityState === 'visible') {
    refreshAiAvailability()
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', onVisibilityChange)
  onUnmounted(() => document.removeEventListener('visibilitychange', onVisibilityChange))
}
</script>

<style scoped>
.ai-entry-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--app-control-radius);
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 18%, var(--el-border-color));
  background: color-mix(in srgb, var(--el-color-primary) 6%, transparent);
  color: var(--el-color-primary);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.18s ease;
  white-space: nowrap;
}

.ai-entry-btn:hover {
  background: color-mix(in srgb, var(--el-color-primary) 10%, transparent);
  border-color: color-mix(in srgb, var(--el-color-primary) 28%, var(--el-border-color));
  box-shadow: none;
}

.ai-entry-btn.active {
  background: var(--app-selected-background);
  border-color: var(--el-color-primary-light-5);
  box-shadow: none;
}

.ai-entry-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.ai-entry-label {
  font-size: 12px;
  letter-spacing: 0.02em;
}


.platform-ai-panel {
  position: fixed;
  top: 10px;
  right: 10px;
  bottom: 10px;
  max-width: calc(100vw - 20px);
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid var(--el-border-color);
  border-radius: 12px;
  background: var(--app-surface-background);
  box-shadow: var(--shadow-overlay);
  outline: none;
}
.platform-ai-panel > :deep(.platform-ai-assistant) { border-radius: inherit; }
.platform-ai-panel.is-resizing { user-select: none; }
.panel-resize-handle {
  position: absolute;
  top: 12px;
  bottom: 12px;
  left: -5px;
  width: 9px;
  z-index: 1;
  cursor: col-resize;
  touch-action: none;
  border-radius: 4px;
}
.panel-resize-handle:hover, .panel-resize-handle:focus-visible,
.is-resizing .panel-resize-handle { background: var(--el-color-primary-light-7); outline: none; }
.empty-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; color: var(--el-text-color-primary); font-size: 14px; }
.empty-header button { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border: 0; border-radius: 6px; color: var(--el-text-color-secondary); background: transparent; cursor: pointer; }
.empty-header button:hover { background: var(--el-fill-color-light); }
.platform-ai-empty { flex: 1; overflow-y: auto; }
.platform-ai-slide-enter-active, .platform-ai-slide-leave-active { transition: transform .2s ease, opacity .2s ease; }
.platform-ai-slide-enter-from, .platform-ai-slide-leave-to { transform: translateX(24px); opacity: 0; }
@media (max-width: 640px) {
  .platform-ai-panel { inset: 0; width: 100% !important; max-width: 100%; border-radius: 0; }
  .panel-resize-handle { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .platform-ai-slide-enter-active, .platform-ai-slide-leave-active { transition: none; }
}
</style>
