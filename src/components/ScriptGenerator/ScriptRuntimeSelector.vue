<template>
  <section
    class="runtime-picker"
    aria-label="构建目标"
  >
    <div
      class="runtime-tabs"
      role="tablist"
      aria-label="运行时"
    >
      <button
        v-for="runtime in runtimes"
        :key="runtime.id"
        type="button"
        class="runtime-tab"
        :class="{ active: form.runtime === runtime.id }"
        :disabled="!runtime.enabled"
        role="tab"
        :aria-selected="form.runtime === runtime.id"
        @click="emit('set-runtime', runtime.id)"
      >
        {{ runtime.label }}
      </button>
    </div>

    <div
      v-if="form.runtime === 'java'"
      class="artifact-tabs"
      role="tablist"
      aria-label="Java 构建类型"
    >
      <button
        type="button"
        :class="{ active: form.generateType === 'webshell' }"
        role="tab"
        :aria-selected="form.generateType === 'webshell'"
        @click="emit('set-generate-type', 'webshell')"
      >
        WebShell
      </button>
      <button
        type="button"
        :class="{ active: form.generateType === 'memoryshell' }"
        role="tab"
        :aria-selected="form.generateType === 'memoryshell'"
        @click="emit('set-generate-type', 'memoryshell')"
      >
        内存构建
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const form = defineModel('form', { type: Object, required: true })
const props = defineProps({
  runtimeGenerators: { type: Object, default: () => ({}) }
})
const emit = defineEmits(['set-runtime', 'set-generate-type'])

const runtimes = computed(() => [
  {
    id: 'java', label: 'Java', enabled: true
  },
  {
    id: 'php', label: 'PHP', enabled: Boolean(props.runtimeGenerators.php)
  }
])
</script>

<style scoped>
.runtime-picker { padding: 0 12px 10px; border-bottom: 1px solid var(--app-surface-border-subtle); }
.runtime-tabs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-bottom: 1px solid var(--sg-border); }
.runtime-tab {
  position: relative; min-width: 0; height: 44px; padding: 0 12px; border: 0;
  background: transparent; color: var(--sg-muted); font-size: 13px; font-weight: 650;
  cursor: pointer; transition: color .16s ease, background-color .16s ease;
}
.runtime-tab::after {
  position: absolute; right: 14px; bottom: -1px; left: 14px; height: 2px;
  background: transparent; content: ''; transition: background-color .16s ease;
}
.runtime-tab:hover:not(:disabled) { background: var(--sg-panel-soft); color: var(--sg-ink); }
.runtime-tab.active { color: var(--sg-blue); }
.runtime-tab.active::after { background: var(--sg-blue); }
.runtime-tab:disabled { opacity: .42; cursor: not-allowed; }
.artifact-tabs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 3px; margin-top: 8px; padding: 3px; border-radius: 7px; background: var(--sg-panel-soft); }
.artifact-tabs button {
  min-width: 0; height: 34px; border: 0; border-radius: 5px; background: transparent;
  color: var(--sg-muted); font-size: 11px; font-weight: 600; cursor: pointer;
  transition: color .16s ease, background-color .16s ease, box-shadow .16s ease;
}
.artifact-tabs button:hover { color: var(--sg-ink); }
.artifact-tabs button.active { background: var(--sg-panel-strong); box-shadow: 0 1px 2px color-mix(in srgb, var(--sg-ink) 10%, transparent); color: var(--sg-blue); }
</style>
