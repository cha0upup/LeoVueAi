<template>
  <div class="theme-switcher">
    <el-dropdown
      trigger="click"
      placement="bottom-end"
      @command="themeStore.setTheme($event)"
    >
      <button
        class="theme-switcher-button"
        type="button"
        :aria-label="themeButtonLabel"
        :title="themeButtonLabel"
      >
        <el-icon
          :size="18"
          aria-hidden="true"
        >
          <Icon :icon="currentThemeIcon" />
        </el-icon>
      </button>
      <template #dropdown>
        <el-dropdown-menu class="theme-menu">
          <div class="theme-menu-head">
            <span class="theme-menu-title">界面主题</span>
            <span class="theme-menu-tip">切换后立即生效</span>
          </div>
          <el-dropdown-item
            v-for="theme in availableThemes"
            :key="theme.value"
            :command="theme.value"
            :class="{ 'is-active': currentTheme === theme.value }"
          >
            <div class="theme-item">
              <div
                class="theme-preview"
                :style="{ background: themePreviewColors[theme.value] || themePreviewColors.light }"
              >
                <span class="theme-preview-dot" />
              </div>
              <div class="theme-text">
                <span class="theme-name">{{ theme.name }}</span>
                <span class="theme-value">{{ themeDescriptions[theme.value] || '界面主题' }}</span>
              </div>
              <el-icon
                v-if="currentTheme === theme.value"
                class="check-icon"
              >
                <Icon :icon="iconMap.check" />
              </el-icon>
            </div>
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { icons } from '@/utils/icons.js'
import { useTheme } from '@/stores/theme'

const themeStore = useTheme()
const { currentTheme } = themeStore
const availableThemes = themeStore.getAvailableThemes()
const currentThemeMeta = computed(() => themeStore.getCurrentTheme())
const themeButtonLabel = computed(() => `切换主题（当前：${currentThemeMeta.value?.name || '默认主题'}）`)
const iconMap = icons

const themeDescriptions = {
  light: '参考 IDEA Light',
  dark: '参考 IDEA Darcula'
}

const themePreviewColors = {
  light: '#edf3ff',
  dark: '#2b2d30'
}

const currentThemeIcon = computed(() => currentTheme.value === 'light' ? iconMap.sunny : iconMap.moon)
</script>

<style scoped>
.theme-switcher {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}

.theme-switcher-button {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  box-sizing: border-box;
  border: 1px solid transparent;
  border-radius: var(--app-control-radius);
  background: transparent;
  color: var(--el-text-color-regular);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.theme-switcher-button:hover {
  background: var(--app-control-background-hover);
  color: var(--el-color-primary);
}

.theme-switcher-button:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

.theme-menu {
  min-width: 220px;
  padding: 6px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 76%, transparent);
  box-shadow: var(--app-shell-shadow-strong);
}

.theme-menu-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px 8px;
}

.theme-menu-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.theme-menu-tip {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.theme-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.theme-preview {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 76%, transparent);
  flex-shrink: 0;
}

.theme-preview-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--app-control-background-hover);
  box-shadow: var(--app-shell-shadow-soft);
}

.theme-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.theme-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.theme-value {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.check-icon {
  color: var(--el-color-primary);
  font-size: 15px;
}

:deep(.el-dropdown-menu__item.is-active) {
  background-color: color-mix(
    in srgb,
    var(--el-color-primary) 12%,
    var(--app-control-background-soft)
  );
  color: var(--el-color-primary);
  border-radius: 10px;
}

:deep(.el-dropdown-menu__item) {
  margin: 2px 0;
  padding: 10px 8px;
  border-radius: 10px;
}
</style>
