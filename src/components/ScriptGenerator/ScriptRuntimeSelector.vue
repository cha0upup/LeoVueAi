<template>
  <section
    class="runtime-picker"
    aria-label="构建目标"
  >
    <div class="runtime-cards">
      <button
        v-for="runtime in runtimes"
        :key="runtime.id"
        type="button"
        class="runtime-card"
        :class="{ active: form.runtime === runtime.id }"
        :disabled="!runtime.enabled"
        @click="emit('set-runtime', runtime.id)"
      >
        <span
          class="runtime-icon"
          :class="`runtime-icon--${runtime.id}`"
        >
          <Icon :icon="runtime.icon" />
        </span>
        <span class="runtime-copy">
          <strong>{{ runtime.label }}</strong>
          <small>{{ runtime.description }}</small>
        </span>
        <span
          v-if="form.runtime === runtime.id"
          class="runtime-active-dot"
        />
      </button>
    </div>

    <div
      v-if="form.runtime === 'java'"
      class="artifact-tabs"
    >
      <button
        type="button"
        :class="{ active: form.generateType === 'webshell' }"
        @click="emit('set-generate-type', 'webshell')"
      >
        WebShell
        <small>JSP / JSPX</small>
      </button>
      <button
        type="button"
        :class="{ active: form.generateType === 'memoryshell' }"
        @click="emit('set-generate-type', 'memoryshell')"
      >
        内存构建
        <small>Injector / Packer</small>
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { icons } from '@/utils/icons.js'

const form = defineModel('form', { type: Object, required: true })
const props = defineProps({
  runtimeGenerators: { type: Object, default: () => ({}) }
})
const emit = defineEmits(['set-runtime', 'set-generate-type'])

const runtimes = computed(() => [
  {
    id: 'java', label: 'Java', icon: icons.codeFile, enabled: true,
    description: 'JSP、JSPX 与内存构建'
  },
  {
    id: 'php', label: 'PHP', icon: icons.codeGenerator, enabled: Boolean(props.runtimeGenerators.php),
    description: props.runtimeGenerators.php
      ? `PHP ${props.runtimeGenerators.php.minimumVersion || '5.6'}+ · 组件化运行时`
      : '运行时模块未加载'
  }
])
</script>

<style scoped>
.runtime-picker { padding: 12px; border-bottom: 1px solid var(--app-surface-border-subtle); }
.runtime-cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.runtime-card {
  position: relative; min-width: 0; min-height: 62px; display: flex; align-items: center; gap: 10px;
  padding: 9px 10px; border: 1px solid var(--sg-border); border-radius: 10px;
  background: var(--sg-panel-strong); color: var(--sg-ink); text-align: left; cursor: pointer;
  transition: border-color .16s ease, background-color .16s ease;
}
.runtime-card:hover:not(:disabled) { border-color: color-mix(in srgb, var(--sg-blue) 45%, var(--sg-border)); }
.runtime-card.active { border-color: var(--sg-blue); background: var(--sg-blue-soft); }
.runtime-card:disabled { opacity: .48; cursor: not-allowed; }
.runtime-icon { width: 34px; height: 34px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; background: var(--sg-panel-soft); color: var(--sg-blue); flex: 0 0 auto; }
.runtime-icon--php { color: var(--sg-purple); }
.runtime-copy { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.runtime-copy strong { font-size: 13px; }
.runtime-copy small { overflow: hidden; color: var(--sg-muted); font-size: 10px; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }
.runtime-active-dot { position: absolute; top: 8px; right: 8px; width: 6px; height: 6px; border-radius: 50%; background: var(--sg-blue); box-shadow: 0 0 0 3px color-mix(in srgb, var(--sg-blue) 16%, transparent); }
.artifact-tabs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; margin-top: 8px; padding: 3px; border-radius: 9px; background: var(--sg-panel-soft); }
.artifact-tabs button { min-height: 38px; display: flex; align-items: center; justify-content: center; gap: 7px; border: 0; border-radius: 7px; background: transparent; color: var(--sg-muted); font-size: 11px; font-weight: 650; cursor: pointer; }
.artifact-tabs button small { font-size: 9px; font-weight: 500; opacity: .72; }
.artifact-tabs button.active { background: var(--sg-panel-strong); color: var(--sg-blue); }
@media (max-width: 760px) { .runtime-cards { grid-template-columns: 1fr; } }
</style>
