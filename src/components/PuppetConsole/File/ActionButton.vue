<template>
  <el-dropdown
    class="action-dropdown"
    trigger="click"
    placement="bottom-end"
  >
    <el-button
      text
      class="action-button"
      size="small"
      :aria-label="`${file.name} 的操作`"
      title="文件操作"
    >
      <el-icon><Icon :icon="iconMap.more" /></el-icon>
    </el-button>
    <template #dropdown>
      <el-dropdown-menu class="action-menu">
        <el-dropdown-item
          v-for="action in actions"
          :key="action.key"
          class="dropdown-item"
          :class="{
            'danger-item': action.danger,
            'is-separated': action.separated
          }"
          @click="emit('action', action.key, props.file)"
        >
          <span class="item-icon-shell">
            <el-icon :class="`${action.key}-icon`">
              <Icon :icon="action.icon" />
            </el-icon>
          </span>
          <span class="item-label">{{ action.label }}</span>
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script setup>
import { computed, inject } from 'vue'
import { FILE_CAPABILITIES_KEY, archiveFormat, supportsFileAction } from './fileCapabilities.js'
import { icons } from '@/utils/icons.js'

// Props
const props = defineProps({
  file: {
    type: Object,
    required: true
  },
  type: {
    type: String,
    required: true
  }
})

// Emits
const emit = defineEmits(['action'])

const iconMap = icons
const capabilities = inject(FILE_CAPABILITIES_KEY, { value: {} })

const actionItems = [
  { key: 'copy', label: '复制', icon: iconMap.copy },
  { key: 'move', label: '移动', icon: iconMap.move },
  { key: 'compress', label: '压缩', icon: iconMap.files },
  { key: 'decompress', label: '解压', icon: iconMap.files },
  { key: 'download', label: '下载', icon: iconMap.download },
  { key: 'rename', label: '重命名', icon: iconMap.rename, separated: true },
  { key: 'chmod', label: '改权限', icon: iconMap.chmod },
  { key: 'copy-path', label: '复制路径', icon: iconMap.copyPath, separated: true },
  { key: 'touch', label: '改时间戳', icon: iconMap.clock },
  { key: 'delete', label: '删除', icon: iconMap.delete, separated: true, danger: true }
]

const actions = computed(() =>
  actionItems.filter(({ key }) => {
    if (key === 'download' && props.type === 'dir') return false
    if (key === 'compress' && archiveFormat(props.file.name)) return false
    return supportsFileAction(capabilities.value, key, props.file)
  })
)
</script>

<style scoped>
.action-button {
  width: 28px;
  height: 28px;
  padding: 0;
  color: var(--el-text-color-secondary);
}
.action-button:hover {
  color: var(--el-color-primary);
}
.action-button:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: -2px;
}
.action-menu {
  min-width: 150px;
}
.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.item-icon-shell {
  display: inline-flex;
  align-items: center;
}
.danger-item {
  color: var(--el-color-danger);
}
.is-separated {
  border-top: 1px solid var(--el-border-color-lighter);
  margin-top: 4px;
  padding-top: 4px;
}
</style>
