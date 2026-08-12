<template>
  <section class="form-group php-runtime-panel">
    <div class="group-heading">
      <div>
        <strong>PHP 构建策略</strong>
        <small>生成轻量包装器，业务能力由组件按需加载</small>
      </div>
      <span class="version-chip">PHP {{ minimumVersion }}+</span>
    </div>

    <div class="runtime-facts">
      <span><b>{{ coreProtocol }}</b> 内核协议</span>
      <span><b>{{ componentCount }}</b> 个组件</span>
      <span><b>On demand</b> 加载</span>
    </div>

    <div class="field-label">
      输出模式
    </div>
    <div class="output-mode-grid">
      <button
        v-for="mode in outputModes"
        :key="mode"
        type="button"
        class="output-mode-card"
        :class="[{ active: form.phpOutputMode === mode }, `tone-${modeDefinition(mode).tone}`]"
        @click="form.phpOutputMode = mode"
      >
        <span class="mode-topline">
          <strong>{{ modeDefinition(mode).label }}</strong>
          <em v-if="mode === defaultOutputMode">推荐</em>
        </span>
        <b>{{ modeDefinition(mode).title }}</b>
        <small>{{ modeDefinition(mode).description }}</small>
        <span
          v-if="requirementLabel(mode)"
          class="requirement-chip"
        >{{ requirementLabel(mode) }}</span>
      </button>
    </div>

    <div class="php-security-row">
      <div>
        <strong>可选 Header 门禁</strong>
        <small>留空时关闭；填写时名称和值必须成对配置</small>
      </div>
      <button
        class="random-button"
        type="button"
        @click="emit('generate-random-header')"
      >
        <Icon :icon="iconMap.refresh" /> 随机
      </button>
    </div>
    <div class="header-pair">
      <el-input
        v-model="form.headerName"
        placeholder="Header 名"
      />
      <span>:</span>
      <el-input
        v-model="form.headerValue"
        placeholder="Header 值"
      />
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { icons } from '@/utils/icons.js'
import { PHP_OUTPUT_MODES } from './scriptGeneratorBuildModel.js'

const iconMap = icons
const form = defineModel('form', { type: Object, required: true })
const props = defineProps({ metadata: { type: Object, default: () => ({}) } })
const emit = defineEmits(['generate-random-header'])

const minimumVersion = computed(() => props.metadata.minimumVersion || form.value.phpMinimumVersion || '5.6')
const outputModes = computed(() => Array.isArray(props.metadata.outputModes) && props.metadata.outputModes.length
  ? props.metadata.outputModes
  : Object.keys(PHP_OUTPUT_MODES))
const defaultOutputMode = computed(() => props.metadata.defaultOutputMode || 'compact')
const coreProtocol = computed(() => props.metadata.coreProtocol || 'M0-M3')
const componentCount = computed(() => Array.isArray(props.metadata.components) ? props.metadata.components.length : 0)
const modeDefinition = mode => PHP_OUTPUT_MODES[mode] || {
  label: mode, title: '自定义输出', description: '由运行时模块提供', tone: 'readable'
}
const requirementLabel = mode => {
  const requirement = props.metadata.requirements?.[mode]
  const extensions = Array.isArray(requirement?.extensions) ? requirement.extensions : []
  return extensions.length ? `依赖 ${extensions.join(' / ')}` : ''
}
</script>

<style scoped>
.group-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 9px; }
.group-heading > div { display: flex; flex-direction: column; gap: 2px; }
.group-heading strong { color: var(--sg-ink); font-size: 12px; }
.group-heading small { color: var(--sg-muted); font-size: 9px; }
.version-chip { padding: 4px 8px; border-radius: 999px; background: color-mix(in srgb, var(--sg-purple) 11%, var(--sg-panel-strong)); color: var(--sg-purple); font-size: 9px; font-weight: 700; white-space: nowrap; }
.runtime-facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin-bottom: 12px; }
.runtime-facts span { min-width: 0; padding: 7px 8px; border: 1px solid var(--sg-border); border-radius: 8px; color: var(--sg-muted); background: var(--sg-panel-soft); font-size: 8px; text-align: center; }
.runtime-facts b { display: block; overflow: hidden; margin-bottom: 2px; color: var(--sg-ink); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.field-label { margin-bottom: 6px; color: var(--sg-muted); font-size: 10px; font-weight: 600; }
.output-mode-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; }
.output-mode-card { min-width: 0; min-height: 104px; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 9px; border: 1px solid var(--sg-border); border-radius: 9px; background: var(--sg-panel-strong); color: var(--sg-ink); text-align: left; cursor: pointer; }
.output-mode-card:hover { border-color: color-mix(in srgb, var(--sg-blue) 45%, var(--sg-border)); }
.output-mode-card.active { border-color: var(--sg-blue); background: var(--sg-blue-soft); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sg-blue) 22%, transparent); }
.mode-topline { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 4px; }
.mode-topline strong { color: var(--sg-blue); font-size: 9px; text-transform: uppercase; }
.mode-topline em { padding: 2px 4px; border-radius: 4px; background: var(--sg-green-soft); color: var(--sg-green); font-size: 7px; font-style: normal; }
.output-mode-card > b { font-size: 11px; }
.output-mode-card > small { color: var(--sg-muted); font-size: 8px; line-height: 1.35; }
.requirement-chip { margin-top: auto; color: var(--el-color-warning); font-size: 7px; }
.php-security-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 14px; margin-bottom: 7px; }
.php-security-row > div { display: flex; flex-direction: column; gap: 2px; }
.php-security-row strong { font-size: 10px; }
.php-security-row small { color: var(--sg-muted); font-size: 8px; }
.random-button { height: 25px; display: inline-flex; align-items: center; gap: 4px; padding: 0 8px; border: 1px solid var(--sg-border); border-radius: 7px; background: var(--sg-panel-strong); color: var(--sg-blue); font-size: 9px; cursor: pointer; }
.header-pair { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 7px; }
.header-pair > span { color: var(--sg-muted); font-weight: 700; }
@media (max-width: 760px) { .output-mode-grid, .runtime-facts { grid-template-columns: 1fr; } }
</style>
