<template>
  <div class="ai-empty-state">
    <div class="empty-icon-shell">
      <el-icon class="empty-icon">
        <Icon icon="mdi:robot-confused-outline" />
      </el-icon>
    </div>
    <div class="empty-title">
      尚未配置 AI 模型
    </div>
    <div class="empty-desc">
      {{ reason || '系统当前没有任何可用的 AI 模型通道，AI 助理无法工作。' }}
    </div>
    <div class="action-row">
      <el-button
        v-if="isAdmin"
        type="primary"
        size="default"
        @click="goToAiConfig"
      >
        <el-icon><Icon icon="mdi:cog-outline" /></el-icon>
        前往配置
      </el-button>
      <div
        v-else
        class="empty-hint"
      >
        <el-icon><Icon icon="mdi:account-tie-outline" /></el-icon>
        请联系管理员在「系统配置」中添加 AI 模型
      </div>
    </div>
    <el-link
      class="refresh-link"
      :underline="false"
      :disabled="loading"
      @click="$emit('refresh')"
    >
      <el-icon
        class="refresh-icon"
        :class="{ 'is-spinning': loading }"
      >
        <Icon icon="mdi:refresh" />
      </el-icon>
      <span>{{ loading ? '检测中…' : '重新检测' }}</span>
    </el-link>
  </div>
</template>

<script setup>
/**
 * AI 未配置时的统一引导面板。
 *
 * 调用方传入 reason（一般来自 useAiAvailability().unavailableReason）和 loading 状态，
 * 并监听 @refresh 触发重新检测。是否显示「前往配置」按钮由当前用户权限自动决定：
 *   - admin：按钮跳到 /admin?tab=system
 *   - 非 admin：显示「联系管理员」chip
 *
 * 在以下场景共用：
 *   - AiDock（节点工作台右侧抽屉）
 *   - PlatformAiAssistant（顶部「平台 AI」抽屉）
 */
import { Icon } from '@iconify/vue'
import { useAppModeNavigation } from '@/composables/useAppModeNavigation.js'
import { useAuth } from '@/composables/useAuth.js'

defineProps({
  /** 不可用原因，通常是 useAiAvailability().unavailableReason */
  reason: { type: String, default: '' },
  /** 是否正在检测中，控制刷新按钮的禁用与图标自旋 */
  loading: { type: Boolean, default: false }
})

defineEmits(['refresh'])

const { isAdmin } = useAuth()
const { goToAdmin } = useAppModeNavigation()

const goToAiConfig = () => {
  goToAdmin({ tab: 'system' })
}
</script>

<style scoped>
.ai-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 32px 24px;
  text-align: center;
  color: var(--el-text-color-primary);
}

.empty-icon-shell {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--el-color-warning) 14%, transparent);
  border: 0;
}

.empty-icon {
  font-size: 32px;
  color: var(--el-color-warning);
}

.empty-title {
  font-size: 15px;
  font-weight: 600;
}

.empty-desc {
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
  max-width: 260px;
}

.empty-hint {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 999px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  background: color-mix(in srgb, var(--app-control-background-soft) 80%, transparent);
  border: 0;
}

.action-row {
  margin-top: 4px;
}

.refresh-link {
  margin-top: 6px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  transition: color 0.15s;
}

.refresh-link:hover {
  color: var(--el-color-primary);
}

.refresh-link.is-disabled,
.refresh-link.is-disabled:hover {
  color: var(--el-text-color-placeholder);
  cursor: not-allowed;
}

.refresh-icon {
  font-size: 14px;
  transition: transform 0.4s ease;
}

.refresh-link:hover .refresh-icon {
  transform: rotate(120deg);
}

.refresh-icon.is-spinning {
  animation: ai-empty-refresh-spin 0.9s linear infinite;
}

@keyframes ai-empty-refresh-spin {
  to { transform: rotate(360deg); }
}
</style>
