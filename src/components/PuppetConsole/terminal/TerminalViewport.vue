<template>
  <div
    ref="containerRef"
    class="terminal-viewport"
  />
</template>
<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

const props = defineProps({
  active: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['ready', 'input', 'activity', 'resize', 'search-results'])

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
    // Search result decorations use xterm's proposed decoration API.
    allowProposedApi: true,
    allowTransparency: true,
    convertEol: true,
    cursorBlink: true,
    cursorStyle: 'block',
    fontFamily: 'JetBrains Mono, Fira Code, Consolas, Monaco, monospace',
    fontSize: 14,
    scrollback: 3000,
    tabStopWidth: 4,
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
  searchAddon.onDidChangeResults((result) => emit('search-results', result))
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

const search = (direction, term, options = {}) => {
  if (!term) return false
  return searchAddon?.[direction](term, {
    caseSensitive: false,
    incremental: false,
    regex: false,
    wholeWord: false,
    decorations: {
      matchBackground: '#375168',
      matchOverviewRuler: '#7dd3fc',
      activeMatchBackground: '#806200',
      activeMatchBorder: '#e3b341',
      activeMatchColorOverviewRuler: '#e3b341'
    },
    ...options
  })
}

const clearSearch = () => {
  searchAddon?.clearDecorations()
  terminal?.clearSelection()
  emit('search-results', { resultIndex: -1, resultCount: 0 })
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
  isVisible: () => Boolean(containerRef.value?.getClientRects().length),
  clear,
  clearSearch,
  fit,
  focus,
  searchNext: (term, options) => search('findNext', term, options),
  searchPrevious: (term, options) => search('findPrevious', term, options),
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
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: #07111b;
}
.terminal-viewport :deep(.xterm) {
  box-sizing: border-box;
  height: 100%;
  padding: 10px 12px 12px;
}
</style>
