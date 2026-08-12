<template>
  <div class="theme-switcher">
    <el-dropdown
      trigger="click"
      placement="bottom-end"
      @command="handleThemeChange"
    >
      <button
        class="theme-switcher-button"
        type="button"
      >
        <span class="theme-icon-shell">
          <el-icon :size="16">
            <Icon :icon="currentThemeIcon" />
          </el-icon>
        </span>
        <span class="theme-copy">
          <span class="theme-label">主题</span>
          <span class="theme-current">{{ currentThemeMeta?.name || '主题' }}</span>
        </span>
        <el-icon class="theme-arrow">
          <Icon :icon="iconMap.arrowDown" />
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
                :style="getThemePreviewStyle(theme.value)"
              >
                <span class="theme-preview-dot" />
              </div>
              <div class="theme-text">
                <span class="theme-name">{{ theme.name }}</span>
                <span class="theme-value">{{ getThemeDescription(theme.value) }}</span>
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
const currentTheme = computed(() => themeStore.currentTheme.value)
const availableThemes = computed(() => themeStore.getAvailableThemes())
const currentThemeMeta = computed(() => themeStore.getCurrentTheme())
const iconMap = icons

const handleThemeChange = (themeName) => {
  themeStore.setTheme(themeName)
}

const currentThemeIcon = computed(() => {
  if (currentTheme.value === 'light') return iconMap.sunny
  return iconMap.moon
})

const getThemeDescription = (themeValue) => {
  const descriptions = {
    light: '参考 IDEA Light',
    dark: '参考 IDEA Darcula'
  }
  return descriptions[themeValue] || '界面主题'
}

const getThemePreviewStyle = (themeValue) => {
  const previewColors = {
    light: '#edf3ff',
    dark: '#2b2d30'
  }
  return {
    background: previewColors[themeValue] || previewColors.light
  }
}
</script>

<style scoped>
.theme-switcher {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  max-width: 100%;
}

.theme-switcher-button {
  min-width: 0;
  max-width: 100%;
  height: 38px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px 0 8px;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 76%, transparent);
  border-radius: 12px;
  background: var(--app-control-background);
  color: var(--el-text-color-regular);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.theme-switcher-button:hover {
  background: var(--app-control-background-hover);
  border-color: color-mix(in srgb, var(--el-color-primary-light-5) 40%, transparent);
  color: var(--el-color-primary);
  transform: translateY(-1px);
}

.theme-icon-shell {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 8px;
  background: color-mix(in srgb, var(--el-color-primary) 12%, var(--app-control-background));
  color: var(--el-color-primary);
}

.theme-copy {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
  flex: 1;
  overflow: hidden;
}

.theme-label {
  font-size: 10px;
  line-height: 1.1;
  color: var(--el-text-color-secondary);
}

.theme-current {
  font-size: 12px;
  line-height: 1.2;
  font-weight: 700;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.theme-arrow {
  color: var(--el-text-color-placeholder);
  font-size: 12px;
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
