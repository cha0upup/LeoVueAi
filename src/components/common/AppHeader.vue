<template>
  <el-header class="app-header">
    <div class="app-header__shell">
      <div class="app-header__left">
        <div class="logo-section">
          <span class="logo-mark">
            <img
              src="/leo-logo.png"
              alt="LEO"
              class="logo-icon"
            >
          </span>
          <span class="logo-copy">
            <strong class="logo-text">{{ title }}</strong>
            <small class="logo-subtitle">{{ subtitle }}</small>
          </span>
        </div>

        <nav
          v-if="modeItems.length"
          class="mode-switcher"
          aria-label="空间切换"
        >
          <button
            v-for="item in modeItems"
            :key="item.key"
            type="button"
            class="mode-switcher__item"
            :class="{ 'is-active': item.key === activeMode }"
            :data-mode="item.key"
            :disabled="item.disabled"
            :aria-current="item.key === activeMode ? 'page' : undefined"
            @click="$emit('mode-change', item.key)"
          >
            <el-icon>
              <Icon :icon="item.icon || iconMap.circleCheck" />
            </el-icon>
            <span>{{ item.label }}</span>
          </button>
        </nav>

        <div class="app-header__center">
          <slot name="center" />
        </div>
      </div>

      <div class="app-header__right">
        <div
          v-if="$slots.tools"
          class="app-header__tools"
        >
          <slot name="tools" />
        </div>

        <ThemeSwitcher />

        <el-dropdown
          trigger="click"
          @command="$emit('command', $event)"
        >
          <div class="user-menu">
            <el-avatar
              :size="34"
              class="user-avatar"
            >
              <Icon :icon="iconMap.user" />
            </el-avatar>
            <div class="user-copy">
              <small>{{ userRoleLabel }}</small>
              <span class="username">{{ username }}</span>
            </div>
            <el-icon class="dropdown-icon">
              <Icon :icon="iconMap.arrowDown" />
            </el-icon>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item
                v-for="item in menuItems"
                :key="item.command"
                :command="item.command"
                :disabled="item.disabled"
                :divided="item.divided"
              >
                <el-icon>
                  <Icon :icon="item.icon" />
                </el-icon>
                {{ item.label }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
  </el-header>
</template>

<script setup>
import { Icon } from '@iconify/vue'
import ThemeSwitcher from '@/components/common/ThemeSwitcher.vue'
import { icons } from '@/utils/icons.js'

defineProps({
  title: {
    type: String,
    default: 'Leo'
  },
  subtitle: {
    type: String,
    default: '主工作台'
  },
  userRoleLabel: {
    type: String,
    default: '当前用户'
  },
  username: {
    type: String,
    default: 'admin'
  },
  menuItems: {
    type: Array,
    default: () => [
      {
        command: 'profile',
        label: '个人信息',
        icon: icons.user
      },
      {
        command: 'changePassword',
        label: '修改密码',
        icon: icons.key
      },
      {
        command: 'logout',
        label: '退出登录',
        icon: icons.switchButton,
        divided: true
      }
    ]
  },
  modeItems: {
    type: Array,
    default: () => []
  },
  activeMode: {
    type: String,
    default: ''
  }
})

defineEmits(['command', 'mode-change'])

const iconMap = icons
</script>

<style scoped>
.app-header {
  height: auto;
  padding: 0 var(--app-page-padding);
  background: var(--app-container-background);
  border: 0;
  border-bottom: 1px solid var(--app-divider-color);
  box-shadow: none;
}

.app-header__shell {
  height: 48px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-layout-gap);
  border-radius: 0;
  border: 0;
  border-bottom: 0;
  background: transparent;
  box-shadow: none;
}

.app-header__left {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.logo-section {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: 8px;
  padding: 0 14px 0 0;
  height: 100%;
  min-width: 98px;
  flex-shrink: 0;
  border-right: 1px solid var(--app-surface-border-subtle);
}

.logo-mark {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-control);
  background: var(--app-brand-background);
  border: 0;
  box-shadow: none;
}

.logo-icon {
  width: 21px;
  height: 21px;
  object-fit: contain;
  filter: none;
}

.logo-copy {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.logo-text {
  font-size: 16px;
  font-weight: 700;
  color: var(--el-color-primary);
  letter-spacing: 0;
}

.logo-subtitle {
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: uppercase;
  color: var(--el-text-color-secondary);
}

.mode-switcher {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  height: 36px;
  margin-right: 8px;
  padding: 3px;
  border: 1px solid var(--app-surface-border-subtle);
  border-radius: var(--app-control-radius);
  background: color-mix(in srgb, var(--app-control-background-soft) 82%, transparent);
}

.mode-switcher__item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 28px;
  min-width: 92px;
  padding: 0 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease;
}

.mode-switcher__item:hover:not(:disabled) {
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 10%, transparent);
}

.mode-switcher__item.is-active {
  color: var(--el-color-primary);
  background: var(--el-bg-color-overlay);
  box-shadow: 0 1px 2px color-mix(in srgb, var(--el-text-color-primary) 8%, transparent);
}

.mode-switcher__item:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.app-header__center {
  flex: 1;
  min-width: 0;
  padding-left: 4px;
  display: flex;
  align-items: center;
}

.app-header__right {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 100%;
  flex-shrink: 0;
}

.app-header__tools {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 0;
  max-width: 100%;
  height: 36px;
  padding: 0 4px;
  border-radius: var(--app-control-radius);
  border: 0;
  background: transparent;
  overflow: hidden;
}

.user-menu {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  min-height: var(--control-height);
  padding: 3px 6px;
  border-radius: var(--app-control-radius);
  border: 1px solid transparent;
  background: transparent;
  transition: all 0.2s ease;
}

.user-menu:hover {
  border-color: transparent;
  background: color-mix(in srgb, var(--el-text-color-primary) 3%, transparent);
  box-shadow: none;
}

.user-avatar {
  border: 1px solid color-mix(in srgb, var(--el-border-color) 16%, transparent);
  background: var(--app-control-background-soft);
}

.user-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.user-copy small {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.username {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.dropdown-icon {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  transition: transform 0.2s ease;
}

.user-menu:hover .dropdown-icon {
  transform: rotate(180deg);
}

:deep(.el-dropdown-menu__item) {
  display: flex;
  align-items: center;
  gap: 8px;
}

:deep(.el-dropdown-menu__item .el-icon) {
  margin-right: 0;
}

@media (max-width: 1200px) {
  .app-header__shell {
    height: auto;
    padding: 0 0 8px;
    flex-direction: column;
    align-items: stretch;
  }

  .app-header__left {
    min-height: 48px;
  }

  .logo-section {
    min-width: 104px;
  }

  .mode-switcher {
    margin-right: 0;
  }

  .app-header__right {
    justify-content: flex-end;
  }
}

@media (max-width: 900px) {
  .app-header {
    padding-left: 12px;
    padding-right: 12px;
  }

  .app-header__left {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .logo-section {
    width: 100%;
    height: 56px;
    margin-right: 0;
    padding-right: 0;
    border-right: 0;
    border-bottom: 1px solid color-mix(in srgb, var(--el-border-color) 28%, transparent);
  }

  .mode-switcher {
    align-self: flex-start;
  }

  .app-header__center {
    padding-left: 0;
  }
}

@media (max-width: 640px) {
  .app-header {
    padding-top: 8px;
  }

  .user-copy small {
    display: none;
  }

  .username {
    max-width: 72px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
