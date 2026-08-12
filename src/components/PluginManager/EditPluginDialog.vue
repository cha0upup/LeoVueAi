<template>
  <el-dialog
    v-model="visible"
    title="编辑插件"
    width="80%"
    :close-on-click-modal="false"
    class="plugin-dialog"
    @close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="formData"
      label-width="110px"
      label-position="left"
      :rules="formRules"
      class="plugin-form"
    >
      <PluginFormFields
        :form-data="formData"
        :plugin-types="pluginTypes"
        mode="edit"
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
          :loading="loading"
          class="submit-btn"
          @click="handleSubmit"
        >
          <el-icon><Icon :icon="iconMap.check" /></el-icon>
          保存更改
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
  plugin: {
    type: Object,
    default: () => ({})
  },
  pluginTypes: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'submit'])

const iconMap = icons
const visible = useDialogVisible(props, emit)
const formRef = ref(null)

const formData = reactive(createEmptyPluginForm())

const formRules = createPluginFormRules()

watch(
  () => props.modelValue,
  (val) => {
    if (val && props.plugin) loadPluginData()
  }
)

const loadPluginData = () => {
  assignPluginForm(formData, props.plugin)
  formData.bytecode = '' // 编辑时默认不显示字节码
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
