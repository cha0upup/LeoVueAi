<template>
  <el-dialog
    v-model="visible"
    :title="isDirectory ? '新建目录' : '新建文件'"
    :width="isDirectory ? '520px' : '680px'"
    :close-on-click-modal="!loading"
    :close-on-press-escape="!loading"
  >
    <el-form
      label-width="86px"
      @submit.prevent="submit"
    >
      <el-form-item label="当前位置">
        <el-input
          :model-value="currentPathLabel"
          disabled
        />
      </el-form-item>
      <el-form-item :label="isDirectory ? '目录名' : '文件名'">
        <el-input
          v-model="form.name"
          :placeholder="isDirectory ? '例如：project-a/logs' : '例如：notes/todo.txt'"
          :disabled="loading"
          @keyup.enter="isDirectory && submit()"
        />
      </el-form-item>
      <el-form-item
        v-if="!isDirectory"
        label="文件内容"
      >
        <el-input
          v-model="form.content"
          type="textarea"
          :rows="10"
          placeholder="UTF-8 文本内容（可留空）"
          :disabled="loading"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button
        :disabled="loading"
        @click="visible = false"
      >
        取消
      </el-button>
      <el-button
        type="primary"
        :loading="loading"
        @click="submit"
      >
        创建
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, reactive, watch } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  type: { type: String, required: true },
  currentPathLabel: { type: String, default: '' },
  loading: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'submit'])
const form = reactive({ name: '', content: '' })
const isDirectory = computed(() => props.type === 'directory')
const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

watch(
  () => props.modelValue,
  (isVisible) => {
    if (!isVisible) return
    form.name = ''
    form.content = ''
  }
)

const submit = () => {
  if (props.loading) return
  emit('submit', { name: form.name, content: form.content })
}
</script>
