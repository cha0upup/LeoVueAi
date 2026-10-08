<template>
  <ArchiveImportDialog
    :model-value="modelValue"
    title="导入伪装"
    extension=".disguise"
    upload-tip="支持单个 .disguise 文件或 .zip（内含若干 .disguise）"
    conflict-tip="disguiseId 由名称 + 版本号派生，同 ID 视为冲突。 重命名会在 ID 后追加时间戳。"
    name-field="disguiseName"
    id-label="伪装 ID"
    id-field="disguiseId"
    allow-rename
    :request="importDisguisesApi"
    @update:model-value="$emit('update:modelValue', $event)"
    @imported="$emit('imported', $event)"
  />
</template>

<script setup>
import ArchiveImportDialog from '@/components/common/ArchiveImportDialog.vue'
import { importDisguisesApi } from '@/services/api/disguises.js'

defineProps({
  modelValue: { type: Boolean, default: false }
})
defineEmits(['update:modelValue', 'imported'])
</script>
