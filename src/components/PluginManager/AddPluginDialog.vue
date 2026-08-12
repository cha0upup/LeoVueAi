<template>
  <el-dialog
    v-model="visible"
    title="新增插件"
    width="80%"
    :close-on-click-modal="false"
    class="plugin-dialog"
    @close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="formData"
      label-width="120px"
      label-position="left"
      :rules="formRules"
      class="plugin-form"
    >
      <PluginFormFields
        :form-data="formData"
        :plugin-types="pluginTypes"
        mode="add"
        @update:form-data="handleFormDataUpdate"
      />

      <div class="form-inline-actions">
        <el-button
          type="danger"
          class="cancel-btn"
          @click="handleClose"
        >
          <el-icon><Icon :icon="iconMap.close" /></el-icon>
          取消
        </el-button>
        <el-button
          type="primary"
          class="submit-btn"
          @click="handleSubmit"
        >
          <el-icon><Icon :icon="iconMap.check" /></el-icon>
          创建插件
        </el-button>
      </div>
    </el-form>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
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
  modelValue: {
    type: Boolean,
    default: false
  },
  pluginTypes: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:modelValue', 'submit'])

const iconMap = icons
const visible = useDialogVisible(props, emit)
const formRef = ref(null)

const formData = reactive(createEmptyPluginForm())

const formRules = createPluginFormRules({ requireBytecode: true })

watch(
  () => props.modelValue,
  (val) => {
    if (val) resetForm()
  }
)

const resetForm = () => {
  assignPluginForm(formData, createEmptyPluginForm())
  formRef.value?.resetFields()
}

const handleFormDataUpdate = (nextFormData) => {
  assignPluginForm(formData, nextFormData)
}

const handleClose = () => {
  visible.value = false
}

const handleSubmit = () => {
  formRef.value?.validate((valid) => {
    if (valid) {
      emit('submit', { ...formData })
    } else {
      showWarning('请填写完整表单内容')
    }
  })
}
</script>

<style scoped>
@import '@/styles/plugin-dialog-shared.css';
</style>
