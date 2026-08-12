<template>
  <button
    type="button"
    class="ai-entry-btn"
    :class="{ active: platformAiDrawer }"
    :title="aiAvailable ? '平台 AI' : (aiUnavailableReason || '平台 AI（未配置）')"
    aria-label="打开平台 AI"
    @click="onPlatformAiClick"
  >
    <Icon
      :icon="iconMap.chatAi"
      class="ai-entry-icon"
    />
    <span class="ai-entry-label">平台 AI</span>
  </button>

  <el-drawer
    v-model="platformAiDrawer"
    size="min(760px, 96vw)"
    direction="rtl"
    :with-header="false"
    :append-to-body="true"
    :destroy-on-close="false"
    class="platform-ai-drawer"
  >
    <PlatformAiAssistant
      v-if="aiAvailable && (platformAiDrawer || platformAiMounted)"
      @close="platformAiDrawer = false"
    />
    <AiNotConfiguredEmpty
      v-else-if="!aiAvailable"
      class="platform-ai-empty"
      :reason="aiUnavailableReason"
      :loading="aiLoading"
      @refresh="refreshAiAvailability"
    />
  </el-drawer>
</template>

<script setup>
import { Icon } from '@iconify/vue'
import { defineAsyncComponent, onUnmounted, ref, watch } from 'vue'

import AiNotConfiguredEmpty from '@/components/common/AiNotConfiguredEmpty.vue'
import { useAiAvailability } from '@/composables/useAiAvailability.js'
import { icons } from '@/utils/icons.js'

const PlatformAiAssistant = defineAsyncComponent(
  () => import('@/components/PlatformAi/PlatformAiAssistant.vue')
)

const iconMap = icons
const platformAiDrawer = ref(false)
const platformAiMounted = ref(false)

watch(platformAiDrawer, (val) => {
  if (val) platformAiMounted.value = true
})

const {
  available: aiAvailable,
  unavailableReason: aiUnavailableReason,
  loading: aiLoading,
  refresh: refreshAiAvailability
} = useAiAvailability()

const onPlatformAiClick = () => {
  platformAiDrawer.value = true
}

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

</style>

<style>
.platform-ai-drawer {
  border-left: 0;
  box-shadow: var(--shadow-overlay);
  height: calc(100% - 20px) !important;
  margin: 10px 0;
  border-radius: 16px 0 0 16px;
  overflow: hidden;
}

@media (max-width: 768px) {
  .el-overlay.is-drawer .platform-ai-drawer.el-drawer {
    width: 100vw !important;
    max-width: 100vw !important;
  }
}

.platform-ai-drawer .el-drawer__body {
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

@media (max-width: 768px) {
  .platform-ai-drawer {
    height: 100% !important;
    margin: 0;
    border-radius: 0;
  }

  .platform-ai-drawer .el-drawer__body {
    min-width: 0;
  }
}
</style>
