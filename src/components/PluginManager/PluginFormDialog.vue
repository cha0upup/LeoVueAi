<template>
  <el-dialog
    v-model="visible"
    :title="editing ? '编辑插件' : '新增插件'"
    width="80%"
    :close-on-click-modal="false"
    class="plugin-dialog"
    @close="visible = false"
  >
    <el-form
      ref="formRef"
      :model="formData"
      :label-width="editing ? '110px' : '120px'"
      label-position="left"
      :rules="formRules"
      class="plugin-form"
    >
      <PluginFormFields
        :form-data="formData"
        :plugin-types="pluginTypes"
        :mode="mode"
        @update:form-data="assignPluginForm(formData, $event)"
      />

      <div class="form-inline-actions">
        <el-button
          type="danger"
          class="cancel-btn"
          @click="visible = false"
        >
          <el-icon><Icon :icon="icons.close" /></el-icon>
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="editing && loading"
          class="submit-btn"
          @click="handleSubmit"
        >
          <el-icon><Icon :icon="icons.check" /></el-icon>
          {{ editing ? '保存更改' : '创建插件' }}
        </el-button>
      </div>
    </el-form>
  </el-dialog>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { icons } from '@/utils/icons.js'
import { showWarning } from '@/utils/messageUtils.js'
import { useDialogVisible } from '@/composables/useDialogVisible.js'
import {
  assignPluginForm,
  createEmptyPluginForm,
  createPluginFormRules
} from '@/utils/plugin.js'
import PluginFormFields from './PluginFormFields.vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  mode: { type: String, default: 'add' },
  plugin: { type: Object, default: () => ({}) },
  pluginTypes: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue', 'submit'])
const visible = useDialogVisible(props, emit)
const editing = computed(() => props.mode === 'edit')
const formRef = ref(null)
const formData = reactive(createEmptyPluginForm())
const formRules = computed(() => createPluginFormRules({ requireBytecode: !editing.value }))

watch(
  () => props.modelValue,
  (isVisible) => {
    if (!isVisible) return
    if (editing.value) {
      if (!props.plugin) return
      assignPluginForm(formData, props.plugin)
      formData.bytecode = '' // 编辑时默认不显示字节码
    } else {
      assignPluginForm(formData, createEmptyPluginForm())
      formRef.value?.resetFields()
    }
  }
)

const handleSubmit = () => {
  formRef.value?.validate((valid) => {
    if (valid) emit('submit', { ...formData })
    else showWarning('请填写完整表单内容')
  })
}
</script>

<style scoped>
@import '@/styles/plugin-dialog-shared.css';
</style>
