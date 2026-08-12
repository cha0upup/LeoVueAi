<template>
  <Teleport to="body">
    <Transition name="palette-fade">
      <div
        v-if="visible"
        class="palette-overlay"
        @mousedown.self="close"
      >
        <div
          class="palette-panel"
          role="dialog"
          aria-modal="true"
          aria-label="打开工具"
        >
          <!-- Search input -->
          <div class="palette-search-row">
            <el-icon class="palette-search-icon">
              <Icon :icon="iconMap.search" />
            </el-icon>
            <input
              ref="inputRef"
              v-model="keyword"
              class="palette-input"
              placeholder="搜索工具模块…"
              autocomplete="off"
              spellcheck="false"
              @keydown="onKeydown"
            >
            <kbd class="palette-esc-hint">ESC</kbd>
          </div>

          <!-- Results list -->
          <div
            ref="listRef"
            class="palette-list"
          >
            <!-- ── Grouped view (no keyword) ── -->
            <template v-if="!keyword.trim()">
              <template
                v-for="group in groupedResults"
                :key="group.phase"
              >
                <div class="palette-group-header">
                  <Icon
                    :icon="group.icon"
                    class="palette-group-icon"
                  />
                  <span>{{ group.label }}</span>
                </div>
                <button
                  v-for="item in group.items"
                  :key="item.key"
                  class="palette-item"
                  :class="{ focused: flatResults.indexOf(item) === focusedIdx, open: isOpen(item.key) }"
                  type="button"
                  @mouseenter="focusedIdx = flatResults.indexOf(item)"
                  @click="select(item.key)"
                >
                  <span class="palette-item-icon-shell">
                    <el-icon :class="item.iconClass"><Icon :icon="item.icon" /></el-icon>
                  </span>
                  <span class="palette-item-body">
                    <span class="palette-item-title">{{ item.title }}</span>
                    <span class="palette-item-desc">{{ item.description }}</span>
                  </span>
                  <span
                    v-if="isOpen(item.key)"
                    class="palette-item-badge is-open"
                  >已开启 ↵</span>
                </button>
              </template>

              <div
                v-if="!groupedResults.length"
                class="palette-empty"
              >
                没有可用工具
              </div>
            </template>

            <!-- ── Flat search results ── -->
            <template v-else>
              <button
                v-for="(item, idx) in flatResults"
                :key="item.key"
                class="palette-item"
                :class="{ focused: idx === focusedIdx, open: isOpen(item.key) }"
                type="button"
                @mouseenter="focusedIdx = idx"
                @click="select(item.key)"
              >
                <span class="palette-item-icon-shell">
                  <el-icon :class="item.iconClass"><Icon :icon="item.icon" /></el-icon>
                </span>
                <span class="palette-item-body">
                  <span class="palette-item-title">{{ item.title }}</span>
                  <span class="palette-item-desc">{{ item.description }}</span>
                </span>
                <span
                  v-if="isOpen(item.key)"
                  class="palette-item-badge"
                >已开启</span>
              </button>

              <div
                v-if="!flatResults.length"
                class="palette-empty"
              >
                没有匹配的工具模块
              </div>
            </template>
          </div>

          <div class="palette-footer">
            <span><kbd>↑↓</kbd> 导航</span>
            <span><kbd>↵</kbd> 打开</span>
            <span><kbd>ESC</kbd> 关闭</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { icons } from '@/utils/icons.js'
import { ATTACK_PHASES } from '@/composables/usePuppetConsoleModules.js'

const iconMap = icons

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  moduleDefinitions: {
    type: Array,
    default: () => []
  },
  isOpen: {
    type: Function,
    default: () => false
  }
})

const emit = defineEmits(['open', 'close'])

const keyword = ref('')
const focusedIdx = ref(0)
const inputRef = ref(null)
const listRef = ref(null)

const normalizeText = (v) => String(v || '').trim().toLowerCase()

// 'ai' lives in dock, 'settings' has its own button — neither belongs in the palette
const EXCLUDED = new Set(['ai', 'settings'])

const eligible = computed(() =>
  props.moduleDefinitions.filter((m) => !EXCLUDED.has(m.key))
)

// ── Grouped view (no keyword) ──────────────────────────────────────
const groupedResults = computed(() => {
  return ATTACK_PHASES
    .map((phase) => ({
      ...phase,
      items: eligible.value.filter((m) => m.phase === phase.key)
    }))
    .filter((g) => g.items.length > 0)
})

// ── Flat search results ────────────────────────────────────────────
const flatResults = computed(() => {
  const kw = normalizeText(keyword.value)
  if (!kw) {
    // flat order mirrors grouped order for keyboard nav
    return groupedResults.value.flatMap((g) => g.items)
  }
  return eligible.value.filter((m) =>
    [m.title, m.description, m.key].some((f) => normalizeText(f).includes(kw))
  )
})

watch(flatResults, () => {
  focusedIdx.value = 0
})

watch(
  () => props.visible,
  async (val) => {
    if (val) {
      keyword.value = ''
      focusedIdx.value = 0
      await nextTick()
      inputRef.value?.focus()
    }
  }
)

function close() {
  emit('close')
}

function select(key) {
  emit('open', key)
  close()
}

function onKeydown(e) {
  if (e.key === 'Escape') {
    close()
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    focusedIdx.value = Math.min(focusedIdx.value + 1, flatResults.value.length - 1)
    scrollFocused()
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    focusedIdx.value = Math.max(focusedIdx.value - 1, 0)
    scrollFocused()
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    const item = flatResults.value[focusedIdx.value]
    if (item) select(item.key)
  }
}

function scrollFocused() {
  nextTick(() => {
    const list = listRef.value
    if (!list) return
    const focused = list.querySelector('.palette-item.focused')
    focused?.scrollIntoView({ block: 'nearest' })
  })
}
</script>

<style scoped>
.palette-overlay {
  position: fixed;
  inset: 0;
  z-index: 9000;
  background: rgb(29 33 41 / 28%);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: min(12vh, 120px);
}

.palette-panel {
  width: min(560px, 92vw);
  border-radius: var(--radius-overlay);
  background: var(--app-container-background);
  border: 1px solid var(--app-border-color);
  box-shadow: var(--shadow-overlay);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Search row */
.palette-search-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 18%, transparent);
  flex-shrink: 0;
}

.palette-search-icon {
  font-size: 16px;
  color: var(--el-text-color-placeholder);
  flex-shrink: 0;
}

.palette-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  caret-color: var(--el-color-primary);
  line-height: 1;
}

.palette-input::placeholder {
  color: var(--el-text-color-placeholder);
  font-weight: 400;
}

.palette-esc-hint {
  display: inline-flex;
  align-items: center;
  padding: 2px 5px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--el-text-color-primary) 6%, transparent);
  border: 1px solid color-mix(in srgb, var(--el-border-color) 40%, transparent);
  font-size: 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: var(--el-text-color-placeholder);
  line-height: 1.2;
  flex-shrink: 0;
}

/* List */
.palette-list {
  overflow-y: auto;
  max-height: min(480px, 64vh);
  padding: 6px;
}

.palette-list::-webkit-scrollbar {
  width: 4px;
}
.palette-list::-webkit-scrollbar-track {
  background: transparent;
}
.palette-list::-webkit-scrollbar-thumb {
  background: var(--el-border-color);
  border-radius: 4px;
}

/* Group header */
.palette-group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px 4px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--el-text-color-placeholder);
  margin-top: 4px;
}

.palette-group-header:first-child {
  margin-top: 0;
}

.palette-group-icon {
  font-size: 13px;
}

/* Items */
.palette-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-radius: var(--radius-control);
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background 0.12s;
}

.palette-item.focused {
  background: color-mix(in srgb, var(--el-color-primary) 9%, var(--app-card-background, #1e1e24));
  border-color: color-mix(in srgb, var(--el-color-primary) 18%, transparent);
}

.palette-item:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--el-color-primary) 36%, transparent);
  outline-offset: 1px;
}

.palette-item-icon-shell {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: color-mix(in srgb, var(--el-color-primary-light-9) 80%, transparent);
  border: 1px solid color-mix(in srgb, var(--el-color-primary-light-7) 14%, transparent);
  font-size: 14px;
}

.palette-item-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.palette-item-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  line-height: 1.2;
}

.palette-item-desc {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}

.palette-item-badge {
  font-size: 10px;
  font-weight: 600;
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 20%, transparent);
  border-radius: 999px;
  padding: 2px 7px;
  white-space: nowrap;
  flex-shrink: 0;
}

.palette-empty {
  padding: 24px 12px;
  text-align: center;
  font-size: 13px;
  color: var(--el-text-color-placeholder);
}

/* Footer hints */
.palette-footer {
  display: flex;
  gap: 16px;
  padding: 8px 14px;
  border-top: 1px solid color-mix(in srgb, var(--el-border-color) 14%, transparent);
  flex-shrink: 0;
}

.palette-footer span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}

.palette-footer kbd {
  display: inline-flex;
  align-items: center;
  padding: 1px 4px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--el-text-color-primary) 6%, transparent);
  border: 1px solid color-mix(in srgb, var(--el-border-color) 40%, transparent);
  font-size: 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: var(--el-text-color-placeholder);
  line-height: 1.2;
}

/* Transition */
.palette-fade-enter-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.palette-fade-leave-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
}
.palette-fade-enter-from,
.palette-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}
</style>
