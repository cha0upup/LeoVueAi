<template>
  <ArchiveImportDialog
    :model-value="modelValue"
    title="导入指纹"
    extension=".json"
    upload-tip="支持单条 .json、对象数组 .json 或 .zip（内含若干 .json）"
    conflict-tip="fingerprintId 由 name + version 派生，同名同版本视为冲突。 重命名会在 version 后追加时间戳。"
    name-field="name"
    id-label="指纹 ID"
    id-field="fingerprintId"
    allow-rename
    :request="importFingerprintsApi"
    @update:model-value="$emit('update:modelValue', $event)"
    @imported="$emit('imported', $event)"
  />
</template>

<script setup>
import ArchiveImportDialog from '@/components/common/ArchiveImportDialog.vue'
import { importFingerprintsApi } from '@/services/api/fingerprints.js'

defineProps({
  modelValue: { type: Boolean, default: false }
})
defineEmits(['update:modelValue', 'imported'])
</script>
