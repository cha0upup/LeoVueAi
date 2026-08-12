<template>
  <div
    class="splitter"
    :class="{ 'is-dragging': dragging, 'is-vertical': direction === 'vertical' }"
    role="separator"
    tabindex="0"
    :aria-orientation="direction === 'vertical' ? 'horizontal' : 'vertical'"
    @mousedown="startDrag"
    @keydown="handleKey"
  >
    <div class="splitter-handle" />
  </div>
</template>

<script setup>
import { ref } from 'vue'

/**
 * 通用可拖拽分栏。
 *
 * 支持鼠标拖拽 + 键盘 ←→（horizontal）/ ↑↓（vertical）调整。
 * v-model 绑定的是被分隔元素的当前尺寸（宽或高）。
 *
 * 用法：
 * <SplitterBar v-model="listWidth" :min="200" :max="500" @change="persist" />
 */

const props = defineProps({
  direction: { type: String, default: 'horizontal' }, // horizontal | vertical
  modelValue: { type: Number, required: true },
  min: { type: Number, default: 160 },
  max: { type: Number, default: 600 },
  step: { type: Number, default: 16 }                  // 键盘步长
})

const emit = defineEmits(['update:modelValue', 'change'])

const dragging = ref(false)
let startPos = 0
let startSize = 0

const clamp = (v) => Math.max(props.min, Math.min(props.max, v))

const startDrag = (e) => {
  dragging.value = true
  startPos = props.direction === 'horizontal' ? e.clientX : e.clientY
  startSize = props.modelValue
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
  document.body.style.cursor = props.direction === 'horizontal' ? 'col-resize' : 'row-resize'
  document.body.style.userSelect = 'none'
  e.preventDefault()
}

const onDrag = (e) => {
  const cur = props.direction === 'horizontal' ? e.clientX : e.clientY
  const delta = cur - startPos
  emit('update:modelValue', clamp(startSize + delta))
}

const stopDrag = () => {
  if (!dragging.value) return
  dragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  emit('change', props.modelValue)
}

const handleKey = (e) => {
  let delta = 0
  if (props.direction === 'horizontal') {
    if (e.key === 'ArrowLeft') delta = -props.step
    else if (e.key === 'ArrowRight') delta = props.step
  } else if (e.key === 'ArrowUp') delta = -props.step
  else if (e.key === 'ArrowDown') delta = props.step
  if (delta) {
    const next = clamp(props.modelValue + delta)
    emit('update:modelValue', next)
    emit('change', next)
    e.preventDefault()
  }
}
</script>

<style scoped>
.splitter {
  position: relative;
  flex-shrink: 0;
  width: 6px;
  cursor: col-resize;
  background: transparent;
  z-index: var(--z-base);
  transition: background var(--motion-fast) var(--motion-easing);
}

.splitter.is-vertical {
  width: auto;
  height: 6px;
  cursor: row-resize;
}

.splitter:hover,
.splitter.is-dragging,
.splitter:focus-visible {
  background: color-mix(in srgb, var(--el-color-primary) 18%, transparent);
  outline: none;
}

.splitter-handle {
  position: absolute;
  inset: 0;
}

.splitter::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 2px;
  height: 28px;
  border-radius: 1px;
  background: var(--el-border-color);
  transform: translate(-50%, -50%);
  opacity: 0;
  transition: opacity var(--motion-fast) var(--motion-easing);
}

.splitter:hover::before,
.splitter.is-dragging::before {
  opacity: 1;
  background: var(--el-color-primary);
}

.splitter.is-vertical::before {
  width: 28px;
  height: 2px;
}
</style>
