<template>
  <div class="hero-identity">
    <div class="host-avatar">
      <Icon :icon="getHostIcon(puppet)" />
      <span
        class="presence-dot"
        :class="{ online: liveSessionCount > 0 }"
      />
    </div>
    <div class="identity-copy">
      <div class="identity-line">
        <h2 :title="getHostDisplayName(puppet)">
          {{ getHostDisplayName(puppet) }}
        </h2>
        <span class="type-chip">{{ isChildHost(puppet) ? '子主机' : '主机' }}</span>
      </div>
      <div class="identity-address">
        <p :title="puppet.connLink">
          {{ puppet.connLink || '未配置连接地址' }}
        </p>
        <button
          v-if="puppet.connLink"
          type="button"
          class="copy-address"
          aria-label="复制连接地址"
          title="复制连接地址"
          @click="copyHostDetail(puppet.connLink)"
        >
          <Icon icon="ep:copy-document" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { getHostIcon, isChildHost, getHostDisplayName, copyHostDetail } from './puppetDetailUtils.js'

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
  flex: 1;
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
  background: var(--el-text-color-placeholder);
}

.presence-dot.online {
  background: var(--el-color-success);
}

.identity-copy {
  min-width: 0;
}

.identity-line {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 3px;
}

.identity-line h2 {
  margin: 0;
  font-size: 16px;
  line-height: 1.2;
  color: var(--pm-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.type-chip {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 7px;
  border-radius: var(--radius-tag);
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
  color: var(--pm-blue);
  background: var(--pm-blue-soft);
}

.identity-copy p {
  margin: 0;
  color: var(--el-text-color-regular);
  font-size: 12px;
  line-height: 1.4;
  overflow-wrap: anywhere;
  min-width: 0;
}

.identity-address {
  display: flex;
  align-items: flex-start;
  gap: 5px;
}

.copy-address {
  display: inline-flex;
  flex-shrink: 0;
  padding: 3px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--pm-muted);
  cursor: pointer;
}

.copy-address:hover {
  color: var(--pm-blue);
  background: var(--pm-panel-soft);
}

.copy-address:focus-visible {
  outline: var(--focus-outline);
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
