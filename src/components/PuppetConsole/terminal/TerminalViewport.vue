<template>
  <div :class="['terminal-viewport', { 'is-active': active }]">
    <div class="terminal-viewport__chrome">
      <span
        :class="['terminal-viewport__mode', { 'is-degraded': capability.degraded }]"
        :title="capability.details"
      >
        <span
          class="terminal-viewport__mode-mark"
          aria-hidden="true"
        />
        {{ capability.shellLabel }}
      </span>
      <span
        class="terminal-viewport__hint"
        :title="capability.details"
      >{{ capability.hint }}</span>
    </div>
    <div
      ref="containerRef"
      class="terminal-viewport__canvas"
    />
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { describeTerminalCapability } from './terminalWorkspaceModel.js'

const props = defineProps({
  active: {
    type: Boolean,
    default: false
  },
  terminalSession: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['ready', 'input', 'activity', 'resize'])
const capability = computed(() => describeTerminalCapability(props.terminalSession))

const TERMINAL_CONFIG = {
  fontSize: 14,
  fontFamily: 'JetBrains Mono, Fira Code, Consolas, Monaco, monospace',
  scrollback: 3000,
  tabStopWidth: 4
}

const containerRef = ref(null)
let terminal = null
let fitAddon = null
let searchAddon = null
let resizeObserver = null
let fitFrame = null
let disposed = false

const scheduleFit = ({ focusAfterFit = false } = {}) => {
  if (disposed) return
  if (fitFrame !== null) cancelAnimationFrame(fitFrame)
  fitFrame = requestAnimationFrame(() => {
    fitFrame = null
    if (disposed || !terminal || !fitAddon) return
    fit()
    if (focusAfterFit) focus()
  })
}

const initializeTerminal = async () => {
  if (!containerRef.value || terminal) return

  terminal = new Terminal({
    allowTransparency: true,
    convertEol: true,
    cursorBlink: true,
    cursorStyle: 'block',
    fontFamily: TERMINAL_CONFIG.fontFamily,
    fontSize: TERMINAL_CONFIG.fontSize,
    scrollback: TERMINAL_CONFIG.scrollback,
    tabStopWidth: TERMINAL_CONFIG.tabStopWidth,
    theme: {
      background: '#07111b',
      foreground: '#e6edf3',
      cursor: '#7dd3fc',
      cursorAccent: '#07111b',
      selectionBackground: 'rgba(125, 211, 252, 0.28)',
      black: '#0f1722',
      red: '#ff7b72',
      green: '#3fb950',
      yellow: '#d29922',
      blue: '#79c0ff',
      magenta: '#bc8cff',
      cyan: '#39c5cf',
      white: '#c9d1d9',
      brightBlack: '#8b949e',
      brightRed: '#ffa198',
      brightGreen: '#56d364',
      brightYellow: '#e3b341',
      brightBlue: '#a5d6ff',
      brightMagenta: '#d2a8ff',
      brightCyan: '#56d4dd',
      brightWhite: '#f0f6fc'
    }
  })

  fitAddon = new FitAddon()
  searchAddon = new SearchAddon()
  const webLinksAddon = new WebLinksAddon()

  terminal.loadAddon(fitAddon)
  terminal.loadAddon(searchAddon)
  terminal.loadAddon(webLinksAddon)
  terminal.open(containerRef.value)
  terminal.onData((data) => emit('input', data))
  terminal.onSelectionChange(() => emit('activity'))
  terminal.onResize(({ cols, rows }) => {
    emit('activity')
    emit('resize', { cols, rows })
  })

  await nextTick()
  if (disposed) return
  scheduleFit({ focusAfterFit: true })

  resizeObserver = new ResizeObserver(() => {
    scheduleFit()
  })
  resizeObserver.observe(containerRef.value)

  emit('ready')
}

const fit = () => {
  fitAddon?.fit()
}

const focus = () => {
  if (!props.active) return
  terminal?.focus()
}

const write = (content) => {
  terminal?.write(content)
}

const clear = () => {
  terminal?.clear()
}

const searchNext = (term, options = {}) => {
  if (!term) return false
  return searchAddon?.findNext(term, {
    caseSensitive: false,
    incremental: false,
    regex: false,
    wholeWord: false,
    ...options
  })
}

const searchPrevious = (term, options = {}) => {
  if (!term) return false
  return searchAddon?.findPrevious(term, {
    caseSensitive: false,
    incremental: false,
    regex: false,
    wholeWord: false,
    ...options
  })
}

const dispose = () => {
  disposed = true
  resizeObserver?.disconnect()
  resizeObserver = null
  if (fitFrame !== null) cancelAnimationFrame(fitFrame)
  fitFrame = null
  const terminalToDispose = terminal
  terminal = null
  fitAddon = null
  searchAddon = null
  // xterm's viewport refresh is animation-frame based. Let an already queued
  // refresh finish before releasing its render service during route/HMR teardown.
  if (terminalToDispose) {
    requestAnimationFrame(() => requestAnimationFrame(() => terminalToDispose.dispose()))
  }
}

defineExpose({
  clear,
  fit,
  focus,
  searchNext,
  searchPrevious,
  write
})

watch(
  () => props.active,
  (active) => {
    if (!active) return
    nextTick(() => {
      if (disposed) return
      scheduleFit({ focusAfterFit: true })
      emit('activity')
    })
  }
)

onMounted(() => {
  disposed = false
  initializeTerminal()
})

onBeforeUnmount(() => {
  dispose()
})
</script>

<style scoped>
.terminal-viewport {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
  border-radius: 0;
  border: 0;
  background: var(--app-code-background);
  box-shadow: inset 0 1px 0 color-mix(in srgb, #ffffff 5%, transparent);
}

.terminal-viewport.is-active {
  border-color: transparent;
}

.terminal-viewport__chrome {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 28px;
  padding: 4px 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--app-code-border) 50%, transparent);
  background: color-mix(
    in srgb,
    var(--app-code-background) 84%,
    var(--app-control-background-soft)
  );
}

.terminal-viewport__mode {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: color-mix(in srgb, var(--app-code-foreground, #e6edf3) 74%, transparent);
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.terminal-viewport__mode-mark {
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
  border-radius: 1px;
  background: #7dd3fc;
  box-shadow: 0 0 0 2px color-mix(in srgb, #7dd3fc 13%, transparent);
}

.terminal-viewport__mode.is-degraded {
  color: color-mix(in srgb, var(--el-color-warning) 82%, #ffffff);
}

.terminal-viewport__mode.is-degraded .terminal-viewport__mode-mark {
  background: var(--el-color-warning);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--el-color-warning) 16%, transparent);
}

.terminal-viewport__hint {
  color: color-mix(in srgb, var(--app-code-foreground, #e6edf3) 46%, transparent);
  font-size: 10px;
}

.terminal-viewport__canvas {
  min-height: 0;
  overflow: hidden;
  padding: 0;
}

.terminal-viewport__canvas :deep(.xterm) {
  box-sizing: border-box;
  height: 100%;
  padding: 10px 12px 12px;
}
</style>
