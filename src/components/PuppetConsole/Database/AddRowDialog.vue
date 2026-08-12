<template>
  <el-dialog
    :model-value="visible"
    title="新增数据"
    width="50vw"
    :close-on-click-modal="false"
    destroy-on-close
    class="add-row-dialog"
    @update:model-value="$emit('update:visible', $event)"
  >
    <div
      v-if="tableColumns.length > 0"
      class="dialog-content"
    >
      <el-table
        :data="tableRows"
        border
        stripe
        size="default"
        class="add-data-table"
        :max-height="500"
      >
        <el-table-column
          prop="fieldName"
          label="字段名"
          width="200"
          fixed="left"
        >
          <template #default="scope">
            <div class="field-info">
              <span class="field-name">{{ scope.row.fieldName }}</span>
              <div class="field-meta">
                <el-tag
                  v-if="!scope.row.nullable"
                  type="danger"
                  size="small"
                  class="required-tag"
                >
                  必填
                </el-tag>
                <el-tag
                  v-else
                  type="info"
                  size="small"
                  class="optional-tag"
                >
                  可选
                </el-tag>
                <span class="field-type">{{ scope.row.type }}</span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          prop="value"
          label="值"
          min-width="300"
        >
          <template #default="scope">
            <template v-if="scope.row.inputComponent === 'el-select'">
              <el-select
                v-model="formData[scope.row.fieldName]"
                placeholder="请选择"
                style="width: 100%"
                clearable
                size="default"
              >
                <el-option
                  label="True"
                  :value="true"
                />
                <el-option
                  label="False"
                  :value="false"
                />
                <el-option
                  v-if="scope.row.nullable"
                  label="NULL"
                  :value="null"
                />
              </el-select>
            </template>
            <component
              :is="scope.row.inputComponent"
              v-else
              v-model="formData[scope.row.fieldName]"
              v-bind="scope.row.inputProps"
              :placeholder="scope.row.nullable ? '请输入（可选）' : '请输入（必填）'"
              style="width: 100%"
              clearable
              size="default"
            />
          </template>
        </el-table-column>
      </el-table>
    </div>
    <!-- 表单操作区，参考“新增主机”页面样式 -->
    <div class="form-inline-actions">
      <el-button
        class="cancel-btn"
        size="default"
        @click="handleCancel"
      >
        <el-icon><Icon :icon="iconMap.close" /></el-icon>
        取消
      </el-button>
      <el-button
        class="submit-btn"
        type="primary"
        :loading="submitting"
        size="default"
        @click="handleConfirm"
      >
        <el-icon v-if="!submitting">
          <Icon :icon="iconMap.plus" />
        </el-icon>
        {{ submitting ? '提交中...' : '确认新增' }}
      </el-button>
    </div>
  </el-dialog>
</template>

<script setup>
import { reactive, ref, watch } from 'vue'

import sqlEngine from './SqlEngine.js'
import { icons } from '@/utils/icons.js'
import { Icon } from '@iconify/vue'
import { handleFormSubmit } from '@/utils/formUtils.js'
import { resetDatabaseRowFormData, useDatabaseRowDialog } from './database-row-dialog-shared.js'
import { showWarning } from '@/utils/messageUtils.js'

const iconMap = icons

const props = defineProps({
  visible: { type: Boolean, default: false },
  tableColumns: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  connection: { type: Object, required: true },
  objectRef: { type: Object, default: null },
  sessionId: { type: String, required: true }
})

const emit = defineEmits(['update:visible', 'confirm', 'cancel', 'success'])

const formData = reactive({})
const submitting = ref(false)
const { getColumnMeta, tableRows } = useDatabaseRowDialog({
  props,
  formData,
  mode: 'insert'
})

watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      resetDatabaseRowFormData(formData)
    }
  }
)

const validateFormData = () => {
  const headers = props.tableColumns.map((column) => column.name).filter(Boolean)
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i]
    const meta = getColumnMeta(i)
    if (
      !meta.nullable &&
      (formData[header] === undefined || formData[header] === null || formData[header] === '')
    ) {
      showWarning(`字段 "${header}" 是必填项`)
      return false
    }
  }
  return true
}

const handleConfirm = async () => {
  if (!validateFormData()) return

  await handleFormSubmit(
    async () => {
      await sqlEngine.insertRow({
        sessionId: props.sessionId,
        connection: props.connection,
        objectRef: props.objectRef,
        row: { ...formData }
      })
    },
    {
      loadingRef: submitting,
      successMessage: '插入成功',
      errorMessage: '插入失败',
      onSuccess: () => {
        emit('update:visible', false)
        emit('success')
        resetDatabaseRowFormData(formData)
      }
    }
  )
}

const handleCancel = () => {
  emit('update:visible', false)
  emit('cancel')
  resetDatabaseRowFormData(formData)
}
</script>

<style scoped>
@import '@/styles/database-row-dialog-shared.css';

.add-row-dialog :deep(.el-dialog__header) {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color-page);
}

/* 表格样式 */
.add-data-table {
  width: 100%;
}
</style>
