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
        <el-dropdown-menu
          class="theme-menu"
          aria-label="界面主题"
        >
          <el-dropdown-item
            v-for="theme in availableThemes"
            :key="theme.value"
            :command="theme.value"
            class="theme-card"
            :class="{ 'is-active': currentTheme === theme.value }"
            :aria-current="currentTheme === theme.value ? 'true' : undefined"
          >
            <div class="theme-item">
              <div
                class="theme-preview"
                :data-theme="theme.value"
                aria-hidden="true"
              >
                <div class="theme-preview__toolbar">
                  <i /><i /><i />
                </div>
                <div class="theme-preview__body">
                  <div class="theme-preview__sidebar">
                    <i /><i /><i />
                  </div>
                  <div class="theme-preview__content">
                    <div class="theme-preview__heading" />
                    <div class="theme-preview__panel">
                      <i /><i /><i />
                    </div>
                  </div>
                </div>
              </div>
              <div class="theme-card__footer">
                <el-icon
                  class="theme-card__icon"
                  aria-hidden="true"
                >
                  <Icon :icon="theme.value === 'light' ? iconMap.sunny : iconMap.moon" />
                </el-icon>
                <span class="theme-name">{{ theme.name }}</span>
                <span
                  class="theme-card__indicator"
                  :class="{ 'is-checked': currentTheme === theme.value }"
                  aria-hidden="true"
                >
                  <el-icon
                    v-if="currentTheme === theme.value"
                    class="check-icon"
                  >
                    <Icon :icon="iconMap.check" />
                  </el-icon>
                </span>
              </div>
            </div>
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { icons as iconMap } from '@/utils/icons.js'
import { useTheme } from '@/stores/theme'

const themeStore = useTheme()
const { currentTheme } = themeStore
const availableThemes = themeStore.getAvailableThemes()
const currentThemeMeta = computed(() => themeStore.getCurrentTheme())
const themeButtonLabel = computed(() => `切换主题（当前：${currentThemeMeta.value?.name || '默认主题'}）`)

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
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  width: 260px;
  max-width: calc(100vw - 24px);
  padding: 8px;
  border-radius: 12px;
}

.theme-item {
  min-width: 0;
  width: 100%;
}

.theme-preview {
  --preview-page: #f0f3f8;
  --preview-surface: #ffffff;
  --preview-sidebar: #e6ebf3;
  --preview-line: #c8d2e2;
  --preview-edge: #dce3ee;
  height: 66px;
  overflow: hidden;
  border: 1px solid var(--preview-edge);
  border-radius: 7px;
  background: var(--preview-page);
  box-shadow: 0 2px 4px rgb(0 0 0 / 4%);
}

.theme-preview[data-theme='dark'] {
  --preview-page: #171c25;
  --preview-surface: #29313e;
  --preview-sidebar: #222a36;
  --preview-line: #49586d;
  --preview-edge: #354052;
}

.theme-preview__toolbar {
  display: flex;
  align-items: center;
  gap: 3px;
  height: 12px;
  padding: 0 5px;
  border-bottom: 1px solid var(--preview-edge);
  background: var(--preview-surface);
}

.theme-preview__toolbar i {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--preview-line);
}

.theme-preview__body {
  display: flex;
  height: calc(100% - 12px);
}

.theme-preview__sidebar {
  display: grid;
  align-content: start;
  gap: 5px;
  width: 22%;
  padding: 7px 4px;
  background: var(--preview-sidebar);
}

.theme-preview__sidebar i {
  height: 3px;
  border-radius: 2px;
  background: var(--preview-line);
}

.theme-preview__sidebar i:first-child {
  background: var(--el-color-primary);
}

.theme-preview__content {
  flex: 1;
  min-width: 0;
  padding: 7px;
}

.theme-preview__heading {
  width: 56%;
  height: 4px;
  margin-bottom: 6px;
  border-radius: 2px;
  background: var(--preview-line);
}

.theme-preview__panel {
  display: grid;
  gap: 3px;
  padding: 5px;
  border-radius: 3px;
  background: var(--preview-surface);
}

.theme-preview__panel i {
  width: 88%;
  height: 2px;
  border-radius: 2px;
  background: var(--preview-line);
}

.theme-preview__panel i:nth-child(2) {
  width: 62%;
}

.theme-preview__panel i:last-child {
  width: 74%;
}

.theme-card__footer {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}

.theme-card__icon {
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.theme-card__indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  border: 1px solid var(--el-border-color);
  border-radius: 50%;
  color: #fff;
}

.theme-card__indicator.is-checked {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary);
}

.theme-name {
  flex: 1;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.check-icon {
  font-size: 11px;
}

:deep(.theme-card.el-dropdown-menu__item) {
  display: block;
  min-width: 0;
  min-height: 0;
  margin: 0;
  padding: 7px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 9px;
  line-height: 18px;
  background: var(--el-bg-color-overlay);
  transition: border-color 0.15s ease, background 0.15s ease;
}

:deep(.theme-card.el-dropdown-menu__item:hover) {
  border-color: var(--el-color-primary-light-5);
  background: var(--app-control-background-soft);
}

:deep(.theme-card.el-dropdown-menu__item.is-active) {
  border-color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 5%, var(--el-bg-color-overlay));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--el-color-primary) 12%, transparent);
}

:deep(.theme-card.el-dropdown-menu__item:focus-visible) {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  :deep(.theme-card.el-dropdown-menu__item) {
    transition: none;
  }
}
</style>
