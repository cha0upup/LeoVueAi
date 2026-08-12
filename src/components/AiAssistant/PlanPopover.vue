<template>
  <div
    v-if="plan"
    ref="rootRef"
    class="plan-popover"
    :class="`plan-popover--${variant}`"
  >
    <!-- Trigger: bar mode (full-width strip) -->
    <button
      v-if="variant === 'bar'"
      class="plan-trigger plan-trigger--bar"
      :class="{ 'is-active': open }"
      :aria-expanded="open"
      @click="toggle"
    >
      <Icon
        icon="mdi:clipboard-text-outline"
        class="trigger-icon"
        :class="`is-${tone}`"
      />
      <span class="trigger-title">{{ plan.title }}</span>
      <span
        class="trigger-badge"
        :class="`is-${tone}`"
      >{{ statusLabel }}</span>
      <span
        v-if="runningStep"
        class="trigger-running"
      >{{ runningStep.description }}</span>
      <span class="trigger-count">{{ completedCount }}/{{ totalCount }} 步骤</span>
      <span
        class="trigger-progress"
        aria-hidden="true"
      >
        <span :style="{ width: `${progressPercent}%` }" />
      </span>
      <Icon
        :icon="open ? 'mdi:chevron-up' : 'mdi:chevron-down'"
        class="trigger-chevron"
      />
    </button>

    <!-- Trigger: toolbar mode (compact button) -->
    <button
      v-else
      class="plan-trigger"
      :class="{ 'is-active': open }"
      :aria-expanded="open"
      @click="toggle"
    >
      <Icon
        icon="mdi:clipboard-text-outline"
        class="trigger-icon"
      />
      <span class="trigger-label">{{ plan.title }}</span>
      <span class="trigger-badge">{{ completedCount }}/{{ totalCount }}</span>
      <Icon
        :icon="open ? 'mdi:chevron-up' : 'mdi:chevron-down'"
        class="trigger-chevron"
      />
    </button>

    <!-- Popover -->
    <Teleport to="body">
      <div
        v-if="open"
        class="plan-backdrop"
        :style="backdropStyle"
        @click="close"
      />
      <div
        v-if="open"
        class="plan-card"
        :style="cardStyle"
      >
        <!-- Header -->
        <div class="card-header">
          <Icon
            :icon="statusIcon"
            class="card-icon"
            :class="`is-${tone}`"
          />
          <span class="card-title">{{ plan.title }}</span>
          <span
            class="card-badge"
            :class="`is-${tone}`"
          >{{ statusLabel }}</span>
          <span class="card-count">{{ completedCount }}/{{ totalCount }} 步骤</span>
          <button
            class="card-close"
            @click="close"
          >
            <Icon icon="mdi:close" />
          </button>
        </div>
        <div class="card-body">
          <div
            v-if="plan.goal"
            class="card-goal"
          >
            <Icon
              icon="mdi:target"
              class="goal-icon"
            />
            <span>{{ plan.goal }}</span>
          </div>
          <div
            v-if="runningStep"
            class="card-running"
          >
            <span class="running-dot" />
            {{ runningStep.description }}
          </div>
          <PlanStepList :steps="plan.steps" />
          <div
            v-if="plan.finalSummary"
            class="card-final"
            :class="`is-${tone}`"
          >
            <Icon :icon="tone === 'success' ? 'mdi:check-circle-outline' : 'mdi:alert-circle-outline'" />
            <span>{{ plan.finalSummary }}</span>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import PlanStepList from './PlanStepList.vue'

const props = defineProps({
  plan: { type: Object, default: null },
  variant: { type: String, default: 'toolbar' } // 'toolbar' | 'bar'
})

const rootRef = ref(null)
const open = ref(false)
const cardStyle = ref({})
const backdropStyle = ref({})

function toggle() {
  open.value = !open.value
  if (open.value) positionCard()
}
function close() { open.value = false }

function positionCard() {
  if (!open.value) return
  nextTick(() => {
    const el = rootRef.value
    if (!el) return
    const rect = el.getBoundingClientRect()
    const margin = 8
    const gap = 6
    const cardW = Math.min(460, window.innerWidth - margin * 2)
    const left = Math.min(
      Math.max(margin, rect.left),
      window.innerWidth - cardW - margin
    )
    const spaceBelow = window.innerHeight - rect.bottom - gap - margin
    const spaceAbove = rect.top - gap - margin
    const placeBelow = spaceBelow >= 320 || spaceBelow >= spaceAbove
    const availableHeight = Math.max(120, placeBelow ? spaceBelow : spaceAbove)
    const maxHeight = Math.min(Math.floor(window.innerHeight * 0.72), availableHeight)

    const overlay = el.closest('.el-overlay')
    const overlayZIndex = Number.parseInt(
      overlay ? window.getComputedStyle(overlay).zIndex : '',
      10
    )
    const backdropZIndex = Number.isFinite(overlayZIndex)
      ? overlayZIndex + 1
      : 3000
    backdropStyle.value = { zIndex: backdropZIndex }
    cardStyle.value = {
      position: 'fixed',
      left: `${Math.max(8, left)}px`,
      width: `${cardW}px`,
      maxHeight: `${maxHeight}px`,
      zIndex: backdropZIndex + 1,
      ...(placeBelow
        ? { top: `${rect.bottom + gap}px`, bottom: 'auto' }
        : { top: 'auto', bottom: `${window.innerHeight - rect.top + gap}px` })
    }
  })
}

function onKeydown(e) { if (e.key === 'Escape' && open.value) close() }
function onViewportChange() { if (open.value) positionCard() }
onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', onViewportChange)
  window.addEventListener('scroll', onViewportChange, true)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', onViewportChange)
  window.removeEventListener('scroll', onViewportChange, true)
})
watch(() => props.plan, (p) => { if (!p) close() })

const tone = computed(() => {
  const s = props.plan?.status
  if (s === 'COMPLETED') return 'success'
  if (s === 'FAILED') return 'danger'
  return 'primary'
})
const statusIcon = computed(() => {
  const map = { COMPLETED: 'mdi:check-circle-outline', FAILED: 'mdi:alert-circle-outline', IN_PROGRESS: 'mdi:clipboard-text-outline', PLANNING: 'mdi:clipboard-text-outline' }
  return map[props.plan?.status] ?? 'mdi:clipboard-text-outline'
})
const statusLabel = computed(() => {
  const map = { PLANNING: '规划中', IN_PROGRESS: '执行中', COMPLETED: '已完成', FAILED: '失败' }
  return map[props.plan?.status] ?? ''
})
const completedCount = computed(() => props.plan?.steps?.filter(s => s.status === 'COMPLETED').length ?? 0)
const totalCount = computed(() => props.plan?.steps?.length ?? 0)
const progressPercent = computed(() => totalCount.value
  ? Math.round((completedCount.value / totalCount.value) * 100)
  : 0)
const runningStep = computed(() => props.plan?.steps?.find(s => s.status === 'RUNNING') || null)
</script>

<style scoped>
.plan-popover--bar {
  flex-shrink: 0;
  padding: 7px 12px 0;
  background: transparent;
}

/* ── Toolbar trigger ────────────────────────────────────────── */
.plan-trigger {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 22%, transparent);
  background: color-mix(in srgb, var(--el-color-primary) 6%, transparent);
  color: var(--el-color-primary);
  font-size: 11.5px;
  font-family: ui-monospace, monospace;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  white-space: nowrap;
}
.plan-trigger:hover, .plan-trigger.is-active {
  background: color-mix(in srgb, var(--el-color-primary) 12%, transparent);
  border-color: color-mix(in srgb, var(--el-color-primary) 35%, transparent);
}
.trigger-icon { font-size: 14px; flex-shrink: 0; }
.trigger-icon.is-primary { color: var(--el-color-primary); }
.trigger-icon.is-success { color: var(--el-color-success); }
.trigger-icon.is-danger  { color: var(--el-color-danger); }
.trigger-label { max-width: 120px; overflow: hidden; text-overflow: ellipsis; font-weight: 600; }
.trigger-badge {
  background: var(--el-color-primary);
  color: #fff;
  border-radius: 999px;
  padding: 0 5px;
  font-size: 10px;
  line-height: 15px;
  font-weight: 700;
}
.trigger-badge.is-success { background: var(--el-color-success); }
.trigger-badge.is-danger  { background: var(--el-color-danger); }
.trigger-chevron { font-size: 12px; flex-shrink: 0; }

/* ── Bar trigger (full-width) ───────────────────────────────── */
.plan-trigger--bar {
  display: flex;
  width: 100%;
  min-height: 38px;
  padding: 6px 10px;
  border-radius: 11px;
  border: none;
  background: color-mix(in srgb, var(--el-color-primary) 5%, transparent);
  font-size: 12px;
  text-align: left;
}
.plan-trigger--bar:hover, .plan-trigger--bar.is-active {
  background: color-mix(in srgb, var(--el-bg-color) 94%, var(--el-color-primary) 6%);
}
.trigger-title { font-weight: 700; color: var(--el-text-color-primary); }
.trigger-running {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--el-color-primary);
  font-size: 11px;
  margin-left: 8px;
}
.trigger-count {
  color: var(--el-text-color-secondary);
  font-size: 11px;
  margin-left: 4px;
  flex-shrink: 0;
}
.trigger-progress {
  width: 58px;
  height: 4px;
  overflow: hidden;
  flex-shrink: 0;
  border-radius: 2px;
  background: color-mix(in srgb, var(--el-text-color-primary) 9%, transparent);
}
.trigger-progress > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--el-color-primary);
  transition: width .25s ease;
}

/* ── Backdrop ────────────────────────────────────────────────── */
.plan-backdrop { position: fixed; inset: 0; }

/* ── Popover card ────────────────────────────────────────────── */
.plan-card {
  background: var(--el-bg-color);
  border: 0;
  border-radius: 14px;
  box-shadow: 0 16px 44px rgba(0,0,0,0.2);
  overflow: hidden;
  max-height: min(70vh, 640px);
  display: flex;
  flex-direction: column;
}
.card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 14px 9px;
  border-bottom: 0;
  flex-shrink: 0;
}
.card-icon { font-size: 16px; flex-shrink: 0; }
.card-icon.is-primary { color: var(--el-color-primary); }
.card-icon.is-success { color: var(--el-color-success); }
.card-icon.is-danger  { color: var(--el-color-danger); }
.card-title { font-size: 13px; font-weight: 700; color: var(--el-text-color-primary); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card-badge { font-size: 10px; font-family: ui-monospace, monospace; padding: 0 5px; border-radius: 999px; line-height: 16px; flex-shrink: 0; }
.card-badge.is-primary { color: var(--el-color-primary); background: color-mix(in srgb, var(--el-color-primary) 10%, transparent); }
.card-badge.is-success { color: var(--el-color-success); background: color-mix(in srgb, var(--el-color-success) 10%, transparent); }
.card-badge.is-danger  { color: var(--el-color-danger);  background: color-mix(in srgb, var(--el-color-danger)  10%, transparent); }
.card-count { font-size: 11px; color: var(--el-text-color-secondary); font-family: ui-monospace, monospace; flex-shrink: 0; }
.card-close { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 4px; border: none; background: none; color: var(--el-text-color-secondary); font-size: 14px; cursor: pointer; flex-shrink: 0; margin-left: 2px; }
.card-close:hover { color: var(--el-text-color-primary); background: color-mix(in srgb, var(--el-text-color-primary) 8%, transparent); }
.card-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 14px 14px;
}
.card-goal { display: flex; align-items: flex-start; gap: 6px; padding: 7px 8px; margin: 8px 0; border-radius: 6px; background: color-mix(in srgb, var(--el-text-color-primary) 4%, transparent); font-size: 12px; color: var(--el-text-color-secondary); line-height: 1.5; }
.goal-icon { color: var(--el-color-warning); font-size: 14px; flex-shrink: 0; margin-top: 1px; }
.card-running { display: flex; align-items: center; gap: 6px; padding: 5px 8px; margin-bottom: 6px; border-radius: 5px; background: color-mix(in srgb, var(--el-color-primary) 6%, transparent); font-size: 11.5px; color: var(--el-color-primary); }
.running-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--el-color-primary); animation: plan-dot-pulse 1.2s ease-in-out infinite; flex-shrink: 0; }
@keyframes plan-dot-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
.card-final { display: flex; align-items: flex-start; gap: 6px; margin-top: 8px; padding: 7px 10px; border-radius: 6px; font-size: 12px; line-height: 1.5; color: var(--el-text-color-primary); }
.card-final.is-success { background: color-mix(in srgb, var(--el-color-success) 6%, transparent); }
.card-final.is-danger  { background: color-mix(in srgb, var(--el-color-danger)  6%, transparent); }
.card-final :deep(svg) { flex-shrink: 0; font-size: 15px; margin-top: 1px; }
.card-final.is-success :deep(svg) { color: var(--el-color-success); }
.card-final.is-danger  :deep(svg) { color: var(--el-color-danger); }
</style>
