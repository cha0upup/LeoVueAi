<template>
  <el-dropdown
    class="action-dropdown"
    trigger="click"
    placement="bottom-end"
  >
    <el-button
      circle
      class="action-button"
      size="small"
      aria-label="文件操作"
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
          @click="emit(action.key, props.file)"
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
const emit = defineEmits(['copy', 'move', 'compress', 'decompress', 'download', 'touch', 'delete', 'rename', 'chmod', 'copy-path'])

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
.action-dropdown {
  display: inline-block;
}

.action-button {
  width: 28px;
  height: 28px;
  min-width: 28px;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 48%, transparent);
  background: color-mix(
    in srgb,
    var(--app-control-background-soft) 78%,
    var(--app-surface-background)
  );
  color: var(--el-text-color-secondary);
  box-shadow: none;
  transition:
    background-color 0.2s,
    color 0.2s,
    transform 0.2s,
    border-color 0.2s;
}

.action-button:hover {
  background: var(--app-control-background-hover);
  border-color: color-mix(in srgb, var(--el-color-primary-light-5) 42%, transparent);
  color: var(--el-color-primary);
  transform: translateY(-1px);
}

.action-button:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--el-color-primary) 38%, transparent);
  outline-offset: 2px;
}

.action-menu {
  min-width: 150px;
  padding: 5px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--el-border-color) 58%, transparent);
  background: var(--app-dialog-background);
  box-shadow: var(--app-shell-shadow-strong);
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 30px;
  padding: 0 8px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-regular);
  transition:
    background-color 0.2s,
    color 0.2s;
}

.dropdown-item.is-separated {
  position: relative;
  margin-top: 7px;
}

.dropdown-item.is-separated::before {
  content: '';
  position: absolute;
  top: -4px;
  left: 8px;
  right: 8px;
  height: 1px;
  background: color-mix(in srgb, var(--el-border-color) 58%, transparent);
}

.dropdown-item:hover {
  background: color-mix(in srgb, var(--el-color-primary) 9%, var(--app-control-background-soft));
  color: var(--el-color-primary);
}

.danger-item:hover {
  background: color-mix(in srgb, var(--el-color-danger-light-9) 78%, transparent);
  color: var(--el-color-danger);
}

.item-icon-shell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  border-radius: 6px;
  background: color-mix(in srgb, var(--app-control-background-soft) 76%, transparent);
}

.item-icon-shell .el-icon {
  font-size: 13px;
}

.item-label {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.copy-icon {
  color: var(--el-color-primary);
}

.move-icon {
  color: var(--el-color-warning-dark-2);
}

.compress-icon,
.decompress-icon {
  color: var(--el-color-warning-dark-2);
}

.download-icon {
  color: var(--el-color-success);
}

.touch-icon {
  color: var(--el-color-primary);
}

.rename-icon {
  color: var(--el-color-primary);
}

.chmod-icon {
  color: var(--el-color-warning-dark-2);
}

.copy-path-icon {
  color: var(--el-text-color-secondary);
}

.delete-icon {
  color: var(--el-color-danger);
}

@media (max-width: 768px) {
  .action-menu {
    min-width: 140px;
  }

  .dropdown-item {
    height: 32px;
    padding: 0 9px;
    font-size: 12px;
  }
}
</style>
