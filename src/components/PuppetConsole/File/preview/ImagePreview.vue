<template>
  <div class="image-preview-container">
    <div class="image-toolbar">
      <el-button-group>
        <el-button
          :disabled="zoomLevel >= MAX_ZOOM"
          size="small"
          @click="zoomIn"
        >
          <el-icon>
            <Icon :icon="iconMap.zoomIn" />
          </el-icon>
          放大
        </el-button>
        <el-button
          :disabled="zoomLevel <= MIN_ZOOM"
          size="small"
          @click="zoomOut"
        >
          <el-icon>
            <Icon :icon="iconMap.zoomOut" />
          </el-icon>
          缩小
        </el-button>
        <el-button
          size="small"
          @click="resetZoom"
        >
          <el-icon>
            <Icon :icon="iconMap.refresh" />
          </el-icon>
          重置
        </el-button>
      </el-button-group>
      <span class="zoom-info">{{ Math.round(zoomLevel * 100) }}%</span>
    </div>
    <div
      class="image-wrapper"
      @wheel="handleImageWheel"
    >
      <img
        :src="imageSrc"
        :style="{ transform: `scale(${zoomLevel})` }"
        alt="Image Preview"
        class="image-preview"
      >
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { icons } from '@/utils/icons.js'

const iconMap = icons

const MIN_ZOOM = 0.5
const MAX_ZOOM = 3
const ZOOM_STEP = 0.25
const DEFAULT_ZOOM = 1

const props = defineProps({
  imageSrc: {
    type: String,
    required: true
  }
})

const zoomLevel = ref(DEFAULT_ZOOM)

watch(
  () => props.imageSrc,
  () => {
    zoomLevel.value = DEFAULT_ZOOM
  }
)

const zoomIn = () => {
  zoomLevel.value = Math.min(MAX_ZOOM, zoomLevel.value + ZOOM_STEP)
}

const zoomOut = () => {
  zoomLevel.value = Math.max(MIN_ZOOM, zoomLevel.value - ZOOM_STEP)
}

const resetZoom = () => {
  zoomLevel.value = DEFAULT_ZOOM
}

const handleImageWheel = (event) => {
  event.preventDefault()
  if (event.deltaY < 0) {
    zoomIn()
  } else {
    zoomOut()
  }
}

</script>

<style scoped>
.image-preview-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: transparent;
}

.image-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  border-bottom: 1px solid var(--preview-soft-border);
  background: var(--preview-toolbar-surface);
  flex-shrink: 0;
}

.zoom-info {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

.image-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  padding: 8px;
  background: var(--preview-muted-surface);
}

.image-preview {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 10px;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.12);
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.image-wrapper::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.image-wrapper::-webkit-scrollbar-track {
  background: var(--el-bg-color-page);
}

.image-wrapper::-webkit-scrollbar-thumb {
  background: var(--el-border-color);
  border-radius: var(--el-border-radius-small);
}

.image-wrapper::-webkit-scrollbar-thumb:hover {
  background: var(--el-border-color-dark);
}
</style>
