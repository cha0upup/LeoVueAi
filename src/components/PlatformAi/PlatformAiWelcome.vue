<template>
  <section class="welcome">
    <h2>管理平台资源</h2>
    <p class="welcome-description">
      查看全平台的节点、用户、团队和流量伪装配置。选择建议填入输入框。
    </p>
    <div class="prompt-list">
      <button
        v-for="prompt in visiblePrompts"
        :key="prompt.title"
        type="button"
        class="prompt-item"
        :disabled="!ready"
        @click="$emit('pick-prompt', prompt.value)"
      >
        <Icon
          :icon="prompt.icon"
          class="prompt-icon"
        />
        <span class="prompt-copy">
          <strong>{{ prompt.title }}</strong>
          <span>{{ prompt.desc }}</span>
        </span>
        <Icon
          icon="lucide:arrow-up-left"
          class="prompt-arrow"
        />
      </button>
    </div>
    <button
      type="button"
      class="more-prompts"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      {{ expanded ? '收起更多操作' : '更多操作' }}
      <Icon :icon="expanded ? 'lucide:chevron-up' : 'lucide:chevron-down'" />
    </button>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'

defineProps({ ready: { type: Boolean, default: false } })
defineEmits(['pick-prompt'])

const prompts = [
  {
    title: '查看在线节点',
    desc: '查看在线 Puppet 的名称和连接协议',
    icon: 'lucide:server',
    value: '列出平台上当前在线的 Puppet，包括名称、协议和在线状态。'
  },
  {
    title: '查看流量伪装配置',
    desc: '整理 Disguise 配置与基本信息',
    icon: 'lucide:route',
    value: '列出平台上所有 Disguise 配置，包括名称和基本信息。'
  },
  {
    title: '汇总平台资源',
    desc: '统计节点、用户、团队和配置数量',
    icon: 'lucide:chart-no-axes-combined',
    value: '帮我汇总平台当前的整体情况：Puppet 数量、用户数量、团队数量和 Disguise 数量。'
  },
  {
    title: '查看用户与团队',
    desc: '梳理团队成员与用户分布',
    icon: 'lucide:users',
    value: '帮我列出平台上所有用户和团队，并简要说明各团队下的成员情况。'
  }
]
const expanded = ref(false)
const visiblePrompts = computed(() => expanded.value ? prompts : prompts.slice(0, 3))
</script>

<style scoped src="@/styles/ai-welcome-shared.css" />
