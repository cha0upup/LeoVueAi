<template>
  <ArchiveImportDialog
    :model-value="modelValue"
    title="导入插件"
    extension=".plugin"
    upload-tip="支持单个 .plugin 文件或 .zip（内含若干 .plugin）"
    conflict-tip="pluginId 由字节码类名 + 版本号派生，同 ID 视为冲突。"
    name-field="pluginName"
    id-label="插件 ID"
    id-field="pluginId"
    name-label="插件名称"
    :result-min-width="90"
    :message-min-width="160"
    :request="importPluginsApi"
    @update:model-value="$emit('update:modelValue', $event)"
    @imported="$emit('imported', $event)"
  />
</template>

<script setup>
import ArchiveImportDialog from '@/components/common/ArchiveImportDialog.vue'
import { importPluginsApi } from '@/services/api/plugins.js'

defineProps({
  modelValue: { type: Boolean, default: false }
})
defineEmits(['update:modelValue', 'imported'])
</script>
