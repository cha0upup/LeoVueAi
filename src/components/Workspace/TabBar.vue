<template>
  <div class="tab-bar">
    <!-- Tab list with overflow arrows -->
    <div
      class="tab-list-wrap"
      :class="{ 'has-left': canScrollLeft, 'has-right': canScrollRight }"
    >
      <!-- Left scroll arrow -->
      <button
        v-show="canScrollLeft"
        class="scroll-arrow scroll-arrow--left"
        type="button"
        aria-label="向左滚动标签"
        tabindex="-1"
        @click="scrollBy(-SCROLL_STEP)"
      >
        <el-icon><Icon :icon="iconMap.arrowLeft" /></el-icon>
      </button>

      <!-- Tabs -->
      <div
        ref="tabListRef"
        class="tab-list"
        @scroll.passive="checkOverflow"
      >
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="tab-item"
          :class="{ active: activeKey === tab.key }"
          type="button"
          @click="emit('activate', tab.key)"
          @mousedown.middle.prevent="emit('close', tab.key)"
        >
          <span class="tab-icon-wrap">
            <el-icon
              class="tab-icon"
              :class="tab.iconClass"
            >
              <Icon :icon="tab.icon" />
            </el-icon>
            <span
              v-if="badges[tab.key] && activeKey !== tab.key"
              class="tab-badge"
              :class="`tab-badge--${badges[tab.key].type || 'info'}`"
            >{{ badges[tab.key].count > 9 ? '9+' : badges[tab.key].count }}</span>
          </span>
          <span class="tab-title">{{ tab.title }}</span>
          <span
            class="tab-close"
            @click.stop="emit('close', tab.key)"
          >
            <el-icon><Icon :icon="iconMap.close" /></el-icon>
          </span>
        </button>
      </div>

      <!-- Right scroll arrow -->
      <button
        v-show="canScrollRight"
        class="scroll-arrow scroll-arrow--right"
        type="button"
        aria-label="向右滚动标签"
        tabindex="-1"
        @click="scrollBy(SCROLL_STEP)"
      >
        <el-icon><Icon :icon="iconMap.arrowRight" /></el-icon>
      </button>
    </div>

    <!-- Spacer -->
    <div class="tab-bar-spacer" />

    <!-- Open tool button -->
    <button
      class="open-tool-btn"
      type="button"
      :title="`打开工具  ${cmdKey}K`"
      @click="emit('open-palette')"
    >
      <el-icon><Icon :icon="iconMap.plus" /></el-icon>
      <span class="open-tool-label">工具</span>
      <kbd class="kbd">{{ cmdKey }}K</kbd>
    </button>

    <!-- Settings button -->
    <el-tooltip
      content="主机设置"
      placement="bottom"
      :show-after="400"
    >
      <button
        class="settings-btn"
        type="button"
        aria-label="主机设置"
        @click="emit('open-settings')"
      >
        <el-icon><Icon :icon="iconMap.setting" /></el-icon>
      </button>
    </el-tooltip>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { icons } from '@/utils/icons.js'

const iconMap = icons

const SCROLL_STEP = 120

const props = defineProps({
  tabs: {
    type: Array,
    default: () => []
  },
  activeKey: {
    type: String,
    default: 'info'
  },
  badges: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['activate', 'close', 'open-palette', 'open-settings'])

const tabListRef = ref(null)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)

const cmdKey = computed(() => {
  const isMac =
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
  return isMac ? '⌘' : 'Ctrl+'
})

// ── Overflow detection ────────────────────────────────────────────────────
function checkOverflow() {
  const el = tabListRef.value
  if (!el) return
  canScrollLeft.value = el.scrollLeft > 1
  canScrollRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
}

function scrollBy(delta) {
  const el = tabListRef.value
  if (!el) return
  el.scrollBy({ left: delta, behavior: 'smooth' })
}

// Scroll active tab into view when activeKey changes
watch(
  () => props.activeKey,
  async () => {
    await nextTick()
    const el = tabListRef.value
    if (!el) return
    const activeBtn = el.querySelector('.tab-item.active')
    activeBtn?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    // Re-check arrows after scroll settles
    setTimeout(checkOverflow, 300)
  }
)

// Re-check when tab list length changes
watch(
  () => props.tabs.length,
  async () => {
    await nextTick()
    checkOverflow()
  }
)

// ResizeObserver to catch container width changes
let ro = null
onMounted(() => {
  checkOverflow()
  if (tabListRef.value) {
    ro = new ResizeObserver(checkOverflow)
    ro.observe(tabListRef.value)
  }
})
onBeforeUnmount(() => ro?.disconnect())
</script>

<style scoped>
.tab-bar {
  flex-shrink: 0;
  height: 36px;
  display: flex;
  align-items: center;
  padding: 0 6px;
  border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 18%, transparent);
  background: var(--app-container-background);
  gap: 4px;
  overflow: hidden;
}

/* ── Tab list wrap ─────────────────────────────────────────────────────────── */

.tab-list-wrap {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.tab-list {
  display: flex;
  align-items: center;
  gap: 2px;
  overflow-x: auto;
  overflow-y: hidden;
  flex: 1;
  min-width: 0;
  scrollbar-width: none;
  /* leave room for arrows when they show */
  scroll-padding-inline: 24px;
}

.tab-list::-webkit-scrollbar {
  display: none;
}

/* ── Scroll arrows ─────────────────────────────────────────────────────────── */

.scroll-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 2;
  width: 22px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 28%, transparent);
  background: color-mix(in srgb, var(--app-surface-background) 92%, var(--el-bg-color-overlay));
  color: var(--el-text-color-secondary);
  font-size: 12px;
  cursor: pointer;
  flex-shrink: 0;
  transition:
    background 0.12s,
    color 0.12s;
  backdrop-filter: blur(4px);
}

.scroll-arrow:hover {
  background: color-mix(in srgb, var(--el-color-primary) 8%, var(--app-surface-background));
  border-color: color-mix(in srgb, var(--el-color-primary) 24%, transparent);
  color: var(--el-color-primary);
}

.scroll-arrow--left {
  left: 0;
}
.scroll-arrow--right {
  right: 0;
}

/* Fade masks to hint at hidden content */
.tab-list-wrap::before,
.tab-list-wrap::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 28px;
  z-index: 1;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s;
}

.tab-list-wrap::before {
  left: 0;
  background: linear-gradient(
    to right,
    color-mix(in srgb, var(--app-surface-background) 85%, transparent),
    transparent
  );
}

.tab-list-wrap::after {
  right: 0;
  background: linear-gradient(
    to left,
    color-mix(in srgb, var(--app-surface-background) 85%, transparent),
    transparent
  );
}

/* Show masks when arrows are present */
.tab-list-wrap.has-left::before {
  opacity: 1;
}
.tab-list-wrap.has-right::after {
  opacity: 1;
}

/* ── Tab items ─────────────────────────────────────────────────────────────── */

.tab-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 8px 0 7px;
  border-radius: var(--radius-control);
  border: 1px solid transparent;
  background: transparent;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition:
    background 0.15s,
    color 0.15s,
    border-color 0.15s;
  position: relative;
}

.tab-item:hover {
  background: color-mix(in srgb, var(--el-text-color-primary) 6%, transparent);
  color: var(--el-text-color-primary);
}

.tab-item.active {
  background: var(--app-selected-background);
  border-color: color-mix(in srgb, var(--el-color-primary) 22%, var(--el-border-color));
  border-bottom-color: var(--el-color-primary);
  border-bottom-width: 2px;
  border-radius: var(--radius-control) var(--radius-control) 0 0;
  padding-bottom: 1px;
  color: var(--el-color-primary);
  font-weight: 600;
}

.tab-icon {
  font-size: 13px;
  flex-shrink: 0;
}

.tab-icon-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}

.tab-badge {
  position: absolute;
  top: -5px;
  right: -6px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  border-radius: 999px;
  font-size: 9px;
  font-weight: 700;
  line-height: 14px;
  text-align: center;
  pointer-events: none;
  border: 1.5px solid var(--app-surface-background, #fff);
}

.tab-badge--info {
  background: var(--el-color-primary);
  color: #fff;
}

.tab-badge--success {
  background: var(--el-color-success);
  color: #fff;
}

.tab-badge--danger {
  background: var(--el-color-danger);
  color: #fff;
}

.tab-badge--warning {
  background: var(--el-color-warning);
  color: #fff;
}

.tab-title {
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1;
}

.tab-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 4px;
  margin-left: 1px;
  color: var(--el-text-color-placeholder);
  font-size: 10px;
  flex-shrink: 0;
  opacity: 0;
  transition:
    opacity 0.15s,
    background 0.15s;
}

.tab-item:hover .tab-close,
.tab-item.active .tab-close {
  opacity: 1;
}

.tab-close:hover {
  background: color-mix(in srgb, var(--el-color-danger) 14%, transparent);
  color: var(--el-color-danger);
}

/* ── Right-side controls ───────────────────────────────────────────────────── */

.tab-bar-spacer {
  flex: 1;
  min-width: 8px;
  max-width: 32px;
}

.open-tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 8px 0 7px;
  border-radius: var(--radius-control);
  border: 1px solid color-mix(in srgb, var(--el-border-color) 30%, transparent);
  background: color-mix(in srgb, var(--app-control-background-soft) 90%, transparent);
  color: var(--el-text-color-secondary);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition:
    background 0.15s,
    color 0.15s,
    border-color 0.15s;
}

.open-tool-btn:hover {
  background: color-mix(in srgb, var(--el-color-primary) 8%, var(--app-control-background-soft));
  border-color: color-mix(in srgb, var(--el-color-primary) 24%, transparent);
  color: var(--el-color-primary);
}

.open-tool-btn .el-icon {
  font-size: 12px;
}

.open-tool-label {
  line-height: 1;
}

.kbd {
  display: inline-flex;
  align-items: center;
  padding: 1px 4px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--el-text-color-primary) 6%, transparent);
  border: 1px solid color-mix(in srgb, var(--el-border-color) 40%, transparent);
  font-size: 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: var(--el-text-color-placeholder);
  letter-spacing: 0.02em;
  line-height: 1.2;
}

.settings-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-control);
  border: 1px solid transparent;
  background: transparent;
  color: var(--el-text-color-placeholder);
  cursor: pointer;
  flex-shrink: 0;
  margin-left: 2px;
  transition:
    background 0.15s,
    color 0.15s,
    border-color 0.15s;
  font-size: 14px;
}

.settings-btn:hover {
  background: color-mix(in srgb, var(--el-text-color-primary) 7%, transparent);
  color: var(--el-text-color-secondary);
  border-color: color-mix(in srgb, var(--el-border-color) 28%, transparent);
}

/* ── Tab icon tint classes ─────────────────────────────────────────────────── */

.tab-icon.ai-icon {
  color: var(--el-color-primary);
}
.tab-icon.info-icon {
  color: var(--el-color-info);
}
.tab-icon.file-icon {
  color: var(--el-color-success);
}
.tab-icon.terminal-icon {
  color: var(--el-color-warning);
}
.tab-icon.proxy-icon {
  color: var(--el-color-primary);
}
.tab-icon.scan-icon {
  color: var(--el-color-danger);
}
.tab-icon.database-icon {
  color: var(--el-color-info);
}
.tab-icon.plugin-icon {
  color: var(--el-color-success);
}
.tab-icon.service-icon {
  color: var(--el-color-primary);
}
.tab-icon.useraccount-icon {
  color: var(--el-color-warning);
}
.tab-icon.netconn-icon {
  color: var(--el-color-info);
}
.tab-icon.http-sender-icon {
  color: var(--el-color-primary);
}
.tab-icon.task-icon {
  color: var(--el-color-primary);
}
</style>
