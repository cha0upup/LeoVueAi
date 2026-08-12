<template>
  <div class="hero-identity">
    <div class="host-avatar">
      <Icon :icon="getHostIcon(puppet)" />
      <span
        class="presence-dot"
        :class="{ online: liveSessionCount > 0, muted: !puppet.connLink }"
      />
    </div>
    <div class="identity-copy">
      <div class="identity-line">
        <h2>{{ puppet.puppetName || '-' }}</h2>
        <span class="type-chip">{{ isChildHost(puppet) ? '子主机' : '主机' }}</span>
        <StatusIndicator
          :status="liveSessionCount > 0 ? 'online' : puppet.connLink ? 'normal' : 'unconfigured'"
          :label="liveSessionCount > 0 ? `${liveSessionCount} 个会话在线` : puppet.connLink ? '已配置' : '未配置'"
          compact
        />
      </div>
      <p>{{ puppet.connLink || '未配置连接地址' }}</p>
    </div>
  </div>
</template>

<script setup>
import { getHostIcon, isChildHost } from './puppetDetailUtils.js'
import StatusIndicator from '@/components/common/StatusIndicator.vue'

defineProps({
  puppet: {
    type: Object,
    required: true
  },
  liveSessionCount: {
    type: Number,
    default: 0
  }
})
</script>

<style scoped>
.hero-identity {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.host-avatar {
  position: relative;
  width: 38px;
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border-radius: 8px;
  border: 0;
  background: var(--pm-panel-soft);
  color: var(--pm-blue);
  font-size: 19px;
}

.presence-dot {
  position: absolute;
  right: 5px;
  bottom: 5px;
  width: 9px;
  height: 9px;
  border: 2px solid var(--pm-panel-strong);
  border-radius: 999px;
  background: var(--pm-blue);
}

.presence-dot.online {
  background: var(--el-color-success);
}

.presence-dot.muted {
  background: var(--pm-placeholder);
}

.identity-copy {
  min-width: 0;
}

.identity-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 3px;
}

.identity-line h2 {
  margin: 0;
  font-size: 16px;
  line-height: 1.2;
  color: var(--pm-ink);
  word-break: break-word;
}

.type-chip {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 7px;
  border-radius: var(--radius-tag);
  font-size: 11px;
  font-weight: 600;
}

.type-chip {
  color: var(--pm-blue);
  background: var(--pm-blue-soft);
}

.identity-copy p {
  margin: 0;
  color: var(--el-text-color-regular);
  font-size: 12px;
  line-height: 1.4;
  word-break: break-word;
}

@media (max-width: 720px) {
  .hero-identity {
    align-items: flex-start;
  }

  .host-avatar {
    width: 36px;
    height: 36px;
  }
}
</style>
