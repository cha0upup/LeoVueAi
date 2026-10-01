<template>
  <el-dropdown
    trigger="click"
    @command="emit($event)"
  >
    <el-button
      text
      size="small"
      :loading="loading"
      aria-label="组件操作"
      title="组件操作"
    >
      <Icon :icon="icons.more" />
    </el-button>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item command="view">
          查看详情
        </el-dropdown-item>
        <el-dropdown-item
          command="bytecode"
          :disabled="!className"
        >
          查看字节码
        </el-dropdown-item>
        <el-dropdown-item
          command="remove"
          divided
          :disabled="!removable || loading"
          class="remove-action"
        >
          移除组件
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script setup>
import { icons } from '@/utils/icons.js'
defineProps({
  className: { type: String, default: '' },
  removable: { type: Boolean, default: false },
  loading: { type: Boolean, default: false }
})
const emit = defineEmits(['view', 'bytecode', 'remove'])
</script>

<style scoped>
.remove-action:not(.is-disabled) { color: var(--el-color-danger); }
</style>
