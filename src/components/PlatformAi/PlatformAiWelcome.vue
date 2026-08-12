<template>
  <div class="welcome">
    <div class="welcome-hero">
      <div class="welcome-icon-wrap">
        <Icon
          :icon="iconMap.platform"
          class="welcome-icon"
        />
      </div>
      <span class="welcome-kicker">平台级智能助手</span>
      <h2 class="welcome-title">
        你好，有什么可以帮你？
      </h2>
      <p class="welcome-desc">
        我可以帮你管理平台的 Puppet、用户、团队和 Disguise 配置，直接提问即可。
      </p>
    </div>
    <div class="welcome-grid">
      <button
        v-for="p in prompts"
        :key="p.title"
        type="button"
        class="prompt-card"
        :disabled="!ready"
        @click="$emit('pick-prompt', p.value)"
      >
        <span class="prompt-card__icon"><Icon :icon="p.icon" /></span>
        <span class="prompt-card__content">
          <span class="prompt-title">{{ p.title }}</span>
          <span class="prompt-desc">{{ p.desc }}</span>
        </span>
        <Icon
          icon="lucide:arrow-up-right"
          class="prompt-card__arrow"
        />
      </button>
    </div>
  </div>
</template>

<script setup>
import { icons } from '@/utils/icons.js'

const iconMap = icons

defineProps({
  ready: {
    type: Boolean,
    default: false
  }
})

defineEmits(['pick-prompt'])

const prompts = [
  {
    title: '查看在线 Puppet',
    desc: '列出当前所有 Puppet 及其状态',
    icon: 'lucide:server',
    value: '列出平台上所有 Puppet 的名称、协议和当前在线状态。'
  },
  {
    title: '用户与团队概览',
    desc: '查看平台用户和团队的概况',
    icon: 'lucide:users',
    value: '帮我列出平台上所有用户和团队，并简要说明各团队下的成员情况。'
  },
  {
    title: 'Disguise 配置列表',
    desc: '查看当前所有流量伪装配置',
    icon: 'lucide:route',
    value: '列出平台上所有 Disguise 配置，包括名称和基本信息。'
  },
  {
    title: '平台资源汇总',
    desc: '一键了解平台整体情况',
    icon: 'lucide:chart-no-axes-combined',
    value: '帮我汇总平台当前的整体情况：Puppet 数量、用户数量、团队数量和 Disguise 数量。'
  }
]
</script>

<style scoped>
/* ==================== 欢迎屏 ==================== */
.welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: clamp(30px, 7vh, 58px) 12px 24px;
  color: var(--el-text-color-regular);
}

.welcome-hero { max-width: 42rem; }

.welcome-icon-wrap {
  width: 48px;
  height: 48px;
  border-radius: 15px;
  border: 0;
  background: color-mix(in srgb, var(--accent) 8%, var(--app-control-background));
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 14px;
  box-shadow: 0 10px 28px color-mix(in srgb, var(--accent) 12%, transparent);
}

.welcome-icon { font-size: 23px; }

.welcome-kicker {
  display: inline-flex;
  margin-bottom: 8px;
  padding: 2px 7px;
  border-radius: var(--radius-tag);
  background: color-mix(in srgb, var(--el-text-color-primary) 3%, transparent);
  border: 0;
  color: var(--el-text-color-regular);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.welcome-title {
  margin: 0 0 8px;
  font-size: clamp(1.25rem, 2.4vw, 1.5rem);
  font-weight: 600;
  color: var(--el-text-color-primary);
  letter-spacing: -0.03em;
  line-height: 1.1;
}

.welcome-desc {
  margin: 0 auto;
  max-width: 38rem;
  font-size: 14px;
  line-height: 1.65;
  color: var(--el-text-color-secondary);
}

.welcome-grid {
  width: 100%;
  max-width: 52rem;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 18px;
}

.prompt-card {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) 18px;
  align-items: center;
  gap: 10px;
  appearance: none;
  border: 0;
  background: color-mix(in srgb, var(--el-bg-color-overlay) 92%, transparent);
  border-radius: var(--radius-container);
  padding: 12px;
  text-align: left;
  cursor: pointer;
  transition: transform 0.16s ease, background 0.16s ease;
}

.prompt-card:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.prompt-card:not(:disabled):hover {
  background: color-mix(in srgb, var(--accent) 4%, var(--app-control-background));
  transform: translateY(-1px);
}

.prompt-card:not(:disabled):focus-visible {
  outline: 2px solid var(--el-color-primary-light-5);
  outline-offset: 1px;
}

.prompt-title {
  display: block;
  margin-bottom: 4px;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.prompt-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  font-size: 16px;
}

.prompt-card__content { min-width: 0; }
.prompt-card__arrow { color: var(--el-text-color-placeholder); font-size: 15px; transition: color .16s, transform .16s; }
.prompt-card:hover .prompt-card__arrow { color: var(--accent); transform: translate(1px, -1px); }

.prompt-desc {
  display: block;
  font-size: 12px;
  line-height: 1.55;
  color: var(--el-text-color-secondary);
}

@media (max-width: 640px) {
  .welcome-grid { grid-template-columns: 1fr; }
}
</style>
